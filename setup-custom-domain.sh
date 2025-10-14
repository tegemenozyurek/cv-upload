#!/bin/bash

# Custom Domain Setup Script
# Bu script Route 53 ve SSL certificate ile custom domain kurar

set -e

# Renkli output için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🌐 Custom Domain Setup${NC}"
echo "=================================="

# Environment variables kontrolü
if [ -z "$AWS_PROFILE" ] && [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo -e "${RED}❌ AWS credentials bulunamadı!${NC}"
    echo "AWS_PROFILE veya AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY ayarlayın"
    exit 1
fi

# Domain adı al
if [ -z "$DOMAIN_NAME" ]; then
    echo -e "${YELLOW}🌐 Domain adını girin (örn: mycv.com):${NC}"
    read -r DOMAIN_NAME
fi

if [ -z "$DOMAIN_NAME" ]; then
    echo -e "${RED}❌ Domain adı gerekli!${NC}"
    exit 1
fi

echo -e "${YELLOW}🌐 Domain: ${DOMAIN_NAME}${NC}"

# CloudFront distribution ID'yi al
if [ -f ".cloudfront-distribution-id" ]; then
    DISTRIBUTION_ID=$(cat .cloudfront-distribution-id)
    echo -e "${YELLOW}☁️  CloudFront Distribution ID: ${DISTRIBUTION_ID}${NC}"
else
    echo -e "${RED}❌ CloudFront distribution bulunamadı!${NC}"
    echo "Önce ./setup-cloudfront.sh çalıştırın"
    exit 1
fi

# Route 53 hosted zone kontrolü
echo -e "${GREEN}🔍 Route 53 hosted zone kontrol ediliyor...${NC}"
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='${DOMAIN_NAME}.'].Id" --output text | sed 's|/hostedzone/||')

if [ -z "$HOSTED_ZONE_ID" ]; then
    echo -e "${YELLOW}📝 Route 53 hosted zone oluşturuluyor...${NC}"
    HOSTED_ZONE_ID=$(aws route53 create-hosted-zone --name "${DOMAIN_NAME}" --caller-reference "cv-upload-$(date +%s)" --query 'HostedZone.Id' --output text | sed 's|/hostedzone/||')
    echo -e "${GREEN}✅ Hosted zone oluşturuldu: ${HOSTED_ZONE_ID}${NC}"
    
    # Name servers'ları göster
    NAME_SERVERS=$(aws route53 get-hosted-zone --id "${HOSTED_ZONE_ID}" --query 'DelegationSet.NameServers' --output text)
    echo ""
    echo -e "${YELLOW}📋 Domain registrar'ınızda bu name server'ları ayarlayın:${NC}"
    echo "$NAME_SERVERS" | tr '\t' '\n' | sed 's/^/  /'
    echo ""
    echo -e "${YELLOW}⏳ Name server değişikliklerinin aktif olması 24-48 saat sürebilir${NC}"
    echo -e "${YELLOW}Devam etmek için Enter'a basın...${NC}"
    read -r
else
    echo -e "${GREEN}✅ Hosted zone bulundu: ${HOSTED_ZONE_ID}${NC}"
fi

# SSL Certificate oluştur
echo -e "${GREEN}🔒 SSL Certificate oluşturuluyor...${NC}"
CERTIFICATE_ARN=$(aws acm request-certificate \
    --domain-name "${DOMAIN_NAME}" \
    --subject-alternative-names "www.${DOMAIN_NAME}" \
    --validation-method DNS \
    --region us-east-1 \
    --query 'CertificateArn' \
    --output text)

echo -e "${GREEN}✅ SSL Certificate oluşturuldu: ${CERTIFICATE_ARN}${NC}"

# Certificate validation DNS records
echo -e "${GREEN}🔍 Certificate validation DNS records alınıyor...${NC}"
sleep 10  # Certificate'nin oluşması için bekle

VALIDATION_RECORDS=$(aws acm describe-certificate \
    --certificate-arn "${CERTIFICATE_ARN}" \
    --region us-east-1 \
    --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord.Name,ResourceRecord.Value]' \
    --output text)

echo -e "${YELLOW}📋 Certificate validation için bu DNS records'ları ekleyin:${NC}"
echo "$VALIDATION_RECORDS" | while read -r domain name value; do
    echo "  ${name} CNAME ${value}"
done

echo ""
echo -e "${YELLOW}⏳ Certificate validation'ın tamamlanmasını bekleyin...${NC}"
echo -e "${YELLOW}Validation tamamlandıktan sonra Enter'a basın...${NC}"
read -r

# CloudFront distribution'ı güncelle
echo -e "${GREEN}☁️  CloudFront distribution güncelleniyor...${NC}"

# Mevcut distribution config'i al
aws cloudfront get-distribution-config --id "${DISTRIBUTION_ID}" > current-config.json

# Config'i güncelle
jq --arg domain "${DOMAIN_NAME}" --arg cert "${CERTIFICATE_ARN}" '
    .DistributionConfig.Aliases = {
        "Quantity": 2,
        "Items": [$domain, "www.\($domain)"]
    } |
    .DistributionConfig.ViewerCertificate = {
        "ACMCertificateArn": $cert,
        "SSLSupportMethod": "sni-only",
        "MinimumProtocolVersion": "TLSv1.2_2021"
    } |
    .DistributionConfig.DefaultCacheBehavior.ViewerProtocolPolicy = "redirect-to-https"
' current-config.json > updated-config.json

# Distribution'ı güncelle
aws cloudfront update-distribution \
    --id "${DISTRIBUTION_ID}" \
    --distribution-config file://updated-config.json \
    --if-match "$(jq -r '.ETag' current-config.json)" > /dev/null

echo -e "${GREEN}✅ CloudFront distribution güncellendi${NC}"

# Route 53 DNS records oluştur
echo -e "${GREEN}🌐 DNS records oluşturuluyor...${NC}"

# CloudFront domain name'i al
CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution --id "${DISTRIBUTION_ID}" --query 'Distribution.DomainName' --output text)

# DNS records oluştur
cat > dns-records.json << EOF
{
    "Changes": [
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "${DOMAIN_NAME}",
                "Type": "A",
                "AliasTarget": {
                    "DNSName": "${CLOUDFRONT_DOMAIN}",
                    "EvaluateTargetHealth": false,
                    "HostedZoneId": "Z2FDTNDATAQYW2"
                }
            }
        },
        {
            "Action": "UPSERT",
            "ResourceRecordSet": {
                "Name": "www.${DOMAIN_NAME}",
                "Type": "A",
                "AliasTarget": {
                    "DNSName": "${CLOUDFRONT_DOMAIN}",
                    "EvaluateTargetHealth": false,
                    "HostedZoneId": "Z2FDTNDATAQYW2"
                }
            }
        }
    ]
}
EOF

aws route53 change-resource-record-sets --hosted-zone-id "${HOSTED_ZONE_ID}" --change-batch file://dns-records.json

echo -e "${GREEN}✅ DNS records oluşturuldu${NC}"

# Temizlik
rm -f current-config.json updated-config.json dns-records.json

echo ""
echo -e "${GREEN}🎉 Custom domain kurulumu tamamlandı!${NC}"
echo "=================================="
echo -e "${GREEN}🌐 Website URL: https://${DOMAIN_NAME}${NC}"
echo -e "${GREEN}🌐 WWW URL: https://www.${DOMAIN_NAME}${NC}"
echo ""
echo -e "${YELLOW}⏳ Not:${NC}"
echo "- DNS değişikliklerinin aktif olması 5-10 dakika sürebilir"
echo "- CloudFront distribution güncellemesi 10-15 dakika sürebilir"
echo ""
echo -e "${YELLOW}💡 Test:${NC}"
echo "Birkaç dakika sonra https://${DOMAIN_NAME} adresini test edin"

