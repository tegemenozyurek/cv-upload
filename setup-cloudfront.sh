#!/bin/bash

# CloudFront Distribution Setup Script
# Bu script CloudFront CDN oluşturur ve HTTPS sağlar

set -e

# Renkli output için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}☁️  CloudFront Distribution Setup${NC}"
echo "=================================="

# Environment variables kontrolü
if [ -z "$AWS_PROFILE" ] && [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo -e "${RED}❌ AWS credentials bulunamadı!${NC}"
    echo "AWS_PROFILE veya AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY ayarlayın"
    exit 1
fi

# S3 bucket adı
BUCKET_NAME=${S3_BUCKET:-"cv-upload-website"}
REGION=${AWS_REGION:-"eu-north-1"}

echo -e "${YELLOW}📦 Bucket: ${BUCKET_NAME}${NC}"
echo -e "${YELLOW}🌍 Region: ${REGION}${NC}"

# S3 bucket'ın var olduğunu kontrol et
if ! aws s3 ls "s3://${BUCKET_NAME}" 2>/dev/null; then
    echo -e "${RED}❌ S3 bucket bulunamadı: ${BUCKET_NAME}${NC}"
    echo "Önce ./deploy-to-s3.sh çalıştırın"
    exit 1
fi

# CloudFront distribution oluştur
echo -e "${GREEN}☁️  CloudFront distribution oluşturuluyor...${NC}"

# Distribution config
cat > cloudfront-config.json << EOF
{
    "CallerReference": "cv-upload-$(date +%s)",
    "Comment": "CV Upload Website Distribution",
    "DefaultRootObject": "index.html",
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-${BUCKET_NAME}",
                "DomainName": "${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com",
                "CustomOriginConfig": {
                    "HTTPPort": 80,
                    "HTTPSPort": 443,
                    "OriginProtocolPolicy": "http-only"
                }
            }
        ]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-${BUCKET_NAME}",
        "ViewerProtocolPolicy": "redirect-to-https",
        "TrustedSigners": {
            "Enabled": false,
            "Quantity": 0
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {
                "Forward": "none"
            }
        },
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000
    },
    "CacheBehaviors": {
        "Quantity": 1,
        "Items": [
            {
                "PathPattern": "/assets/*",
                "TargetOriginId": "S3-${BUCKET_NAME}",
                "ViewerProtocolPolicy": "redirect-to-https",
                "TrustedSigners": {
                    "Enabled": false,
                    "Quantity": 0
                },
                "ForwardedValues": {
                    "QueryString": false,
                    "Cookies": {
                        "Forward": "none"
                    }
                },
                "MinTTL": 0,
                "DefaultTTL": 31536000,
                "MaxTTL": 31536000
            }
        ]
    },
    "CustomErrorResponses": {
        "Quantity": 1,
        "Items": [
            {
                "ErrorCode": 404,
                "ResponsePagePath": "/index.html",
                "ResponseCode": "200",
                "ErrorCachingMinTTL": 300
            }
        ]
    },
    "Enabled": true,
    "PriceClass": "PriceClass_100"
}
EOF

# Distribution oluştur
DISTRIBUTION_ID=$(aws cloudfront create-distribution --distribution-config file://cloudfront-config.json --query 'Distribution.Id' --output text)

echo -e "${GREEN}✅ CloudFront distribution oluşturuldu!${NC}"
echo -e "${YELLOW}📋 Distribution ID: ${DISTRIBUTION_ID}${NC}"

# Distribution detaylarını al
DISTRIBUTION_DOMAIN=$(aws cloudfront get-distribution --id "${DISTRIBUTION_ID}" --query 'Distribution.DomainName' --output text)

echo ""
echo -e "${GREEN}🎉 CloudFront kurulumu tamamlandı!${NC}"
echo "=================================="
echo -e "${GREEN}🌐 HTTPS URL: https://${DISTRIBUTION_DOMAIN}${NC}"
echo ""
echo -e "${YELLOW}⏳ Not:${NC}"
echo "- Distribution'ın aktif olması 10-15 dakika sürebilir"
echo "- İlk deployment'da cache'lenmemiş içerik görebilirsiniz"
echo ""
echo -e "${YELLOW}📝 Sonraki adımlar:${NC}"
echo "1. Distribution'ın hazır olmasını bekleyin"
echo "2. https://${DISTRIBUTION_DOMAIN} adresini test edin"
echo "3. Custom domain eklemek için: ./setup-custom-domain.sh"
echo ""
echo -e "${YELLOW}💡 Deployment için:${NC}"
echo "Artık ./deploy-to-s3.sh çalıştırdığınızda CloudFront otomatik olarak güncellenecek"

# Temizlik
rm cloudfront-config.json

# Distribution ID'yi kaydet
echo "${DISTRIBUTION_ID}" > .cloudfront-distribution-id
echo -e "${GREEN}💾 Distribution ID .cloudfront-distribution-id dosyasına kaydedildi${NC}"
