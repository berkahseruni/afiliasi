#!/bin/bash
# Script deploy otomatis untuk update project di VPS
# Cara pakai: ./deploy.sh

set -e  # hentikan script kalau ada perintah yang gagal

APP_NAME="afiliasi"

echo "==> Menarik perubahan terbaru dari GitHub..."
git pull

echo "==> Install/update dependency..."
npm install

echo "==> Restart aplikasi lewat PM2..."
pm2 restart "$APP_NAME"

echo "==> Selesai! Aplikasi sudah update dan berjalan."
pm2 status "$APP_NAME"
