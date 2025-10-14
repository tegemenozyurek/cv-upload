# AWS S3 + CloudFront Deployment Guide

Bu rehber React projenizi AWS S3 + CloudFront ile deploy etmenizi sağlar.

## 🚀 Hızlı Başlangıç

### 1. AWS CLI Kurulumu ve Konfigürasyonu

```bash
# AWS CLI kurulumu (macOS)
brew install awscli

# AWS CLI kurulumu (Linux/Windows)
# https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

# AWS credentials konfigürasyonu
aws configure
# Access Key ID: [AWS_ACCESS_KEY_ID]
# Secret Access Key: [AWS_SECRET_ACCESS_KEY]
# Default region: eu-north-1
# Default output format: json
```

### 2. Environment Variables

`.env` dosyası oluşturun:

```bash
# .env
VITE_S3_BUCKET=cv-upload-website-[unique-id]
VITE_S3_REGION=eu-north-1
VITE_S3_PREFIX=
```

### 3. Deployment

```bash
# Script'leri çalıştırılabilir yap
chmod +x deploy-to-s3.sh
chmod +x setup-cloudfront.sh
chmod +x setup-custom-domain.sh

# S3'e deploy et
./deploy-to-s3.sh

# CloudFront kurulumu (HTTPS için)
./setup-cloudfront.sh

# Custom domain (opsiyonel)
./setup-custom-domain.sh
```

## 📋 Detaylı Adımlar

### Adım 1: S3 Bucket Oluşturma ve Static Website Hosting

```bash
# 1. Projeyi build et
npm run build

# 2. S3 bucket oluştur
aws s3 mb s3://cv-upload-website-$(date +%s) --region eu-north-1

# 3. Bucket policy ayarla (public read access)
aws s3api put-bucket-policy --bucket YOUR_BUCKET_NAME --policy '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
        }
    ]
}'

# 4. Static website hosting aktif et
aws s3 website s3://YOUR_BUCKET_NAME --index-document index.html --error-document index.html

# 5. Dosyaları upload et
aws s3 sync dist/ s3://YOUR_BUCKET_NAME --delete
```

### Adım 2: CloudFront Distribution

```bash
# CloudFront distribution oluştur
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

### Adım 3: Custom Domain (Opsiyonel)

```bash
# Route 53 hosted zone oluştur
aws route53 create-hosted-zone --name yourdomain.com --caller-reference $(date +%s)

# SSL certificate oluştur
aws acm request-certificate --domain-name yourdomain.com --validation-method DNS --region us-east-1
```

## 🔄 Otomatik Deployment (GitHub Actions)

### GitHub Actions Workflow

`.github/workflows/deploy.yml` dosyası oluşturun:

```yaml
name: Deploy to AWS S3 + CloudFront

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
      env:
        VITE_S3_BUCKET: ${{ secrets.S3_BUCKET }}
        VITE_S3_REGION: ${{ secrets.S3_REGION }}
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ secrets.AWS_REGION }}
    
    - name: Deploy to S3
      run: |
        aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
        aws s3 cp s3://${{ secrets.S3_BUCKET }}/index.html s3://${{ secrets.S3_BUCKET }}/index.html \
          --metadata-directive REPLACE \
          --cache-control "no-cache, no-store, must-revalidate" \
          --content-type "text/html"
    
    - name: Invalidate CloudFront
      run: |
        aws cloudfront create-invalidation \
          --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
          --paths "/*"
```

### GitHub Secrets Ayarlama

Repository Settings > Secrets and variables > Actions:

- `AWS_ACCESS_KEY_ID`: AWS Access Key
- `AWS_SECRET_ACCESS_KEY`: AWS Secret Key
- `S3_BUCKET`: S3 bucket adı
- `S3_REGION`: AWS region (eu-north-1)
- `CLOUDFRONT_DISTRIBUTION_ID`: CloudFront distribution ID

## 💰 Maliyet Tahmini

### S3 Storage
- İlk 50 GB: Ücretsiz
- Sonrası: $0.023/GB/ay

### CloudFront
- İlk 1 TB transfer: Ücretsiz
- Sonrası: $0.085/GB

### Route 53 (Custom domain için)
- Hosted zone: $0.50/ay
- DNS queries: $0.40/milyon query

**Toplam tahmini maliyet: $1-5/ay** (düşük trafik için)

## 🔧 Troubleshooting

### CORS Hatası
```bash
# S3 bucket CORS policy
aws s3api put-bucket-cors --bucket YOUR_BUCKET_NAME --cors-configuration '{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": []
        }
    ]
}'
```

### Cache Sorunları
```bash
# CloudFront invalidation
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### SSL Certificate Sorunları
```bash
# Certificate validation durumu
aws acm describe-certificate --certificate-arn YOUR_CERTIFICATE_ARN --region us-east-1
```

## 📚 Faydalı Komutlar

```bash
# S3 bucket listesi
aws s3 ls

# CloudFront distribution listesi
aws cloudfront list-distributions

# Route 53 hosted zones
aws route53 list-hosted-zones

# SSL certificates
aws acm list-certificates --region us-east-1
```

## 🎯 Sonuç

Deployment tamamlandıktan sonra:

1. **S3 URL**: `http://YOUR_BUCKET_NAME.s3-website-eu-north-1.amazonaws.com`
2. **CloudFront URL**: `https://YOUR_DISTRIBUTION_ID.cloudfront.net`
3. **Custom Domain**: `https://yourdomain.com` (eğer ayarladıysanız)

Projeniz artık GitHub Pages benzeri şekilde AWS'de yayında! 🚀