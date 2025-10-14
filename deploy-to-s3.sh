#!/bin/bash

# S3 Static Website Deployment Script
# Bu script projenizi S3'e deploy eder

set -e

# Renkli output için
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 CV Upload - S3 Deployment${NC}"
echo "=================================="

# Environment variables kontrolü
if [ -z "$AWS_PROFILE" ] && [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo -e "${RED}❌ AWS credentials bulunamadı!${NC}"
    echo "AWS_PROFILE veya AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY ayarlayın"
    exit 1
fi

# S3 bucket adı
BUCKET_NAME=${S3_BUCKET:-"cv-upload-website-$(date +%s)"}
REGION=${AWS_REGION:-"eu-north-1"}

echo -e "${YELLOW}📦 Bucket: ${BUCKET_NAME}${NC}"
echo -e "${YELLOW}🌍 Region: ${REGION}${NC}"

# Build işlemi
echo -e "${GREEN}🔨 Building project...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build başarısız! dist klasörü bulunamadı.${NC}"
    exit 1
fi

# S3 bucket oluştur (eğer yoksa)
echo -e "${GREEN}🪣 S3 bucket kontrol ediliyor...${NC}"
if ! aws s3 ls "s3://${BUCKET_NAME}" 2>/dev/null; then
    echo -e "${YELLOW}📦 Bucket oluşturuluyor...${NC}"
    aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}"
    
    # Bucket policy - public read access
    cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
        }
    ]
}
EOF
    
    aws s3api put-bucket-policy --bucket "${BUCKET_NAME}" --policy file://bucket-policy.json
    rm bucket-policy.json
    
    # Static website hosting ayarları
    aws s3 website "s3://${BUCKET_NAME}" --index-document index.html --error-document index.html
    
    echo -e "${GREEN}✅ Bucket oluşturuldu ve static website hosting aktif edildi${NC}"
else
    echo -e "${GREEN}✅ Bucket zaten mevcut${NC}"
fi

# Dosyaları upload et
echo -e "${GREEN}📤 Dosyalar upload ediliyor...${NC}"
aws s3 sync dist/ "s3://${BUCKET_NAME}" --delete --region "${REGION}"

# Cache headers ayarla
echo -e "${GREEN}⚙️  Cache headers ayarlanıyor...${NC}"
aws s3 cp "s3://${BUCKET_NAME}/index.html" "s3://${BUCKET_NAME}/index.html" \
    --metadata-directive REPLACE \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html"

aws s3 cp "s3://${BUCKET_NAME}/assets/" "s3://${BUCKET_NAME}/assets/" \
    --recursive \
    --metadata-directive REPLACE \
    --cache-control "max-age=31536000" \
    --exclude "*" \
    --include "*.js" \
    --include "*.css"

# Website URL'ini al
WEBSITE_URL="http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com"

echo ""
echo -e "${GREEN}🎉 Deployment tamamlandı!${NC}"
echo "=================================="
echo -e "${GREEN}🌐 Website URL: ${WEBSITE_URL}${NC}"
echo ""
echo -e "${YELLOW}📝 Sonraki adımlar:${NC}"
echo "1. CloudFront distribution oluşturmak için: ./setup-cloudfront.sh"
echo "2. Custom domain eklemek için: ./setup-custom-domain.sh"
echo ""
echo -e "${YELLOW}💡 Not:${NC}"
echo "- Bu URL HTTP'dir. HTTPS için CloudFront kullanın."
echo "- Bucket adı: ${BUCKET_NAME}"
echo "- Region: ${REGION}"

