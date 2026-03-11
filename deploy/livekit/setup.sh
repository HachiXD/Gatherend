#!/bin/bash
# VPS3 (LiveKit) — one-time OS setup
# Run as root or with sudo before deploying LiveKit.
set -euo pipefail

echo "=== Installing Docker ==="
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu

echo "=== Configuring kernel parameters for RTC/UDP ==="
cat > /etc/sysctl.d/00-media.conf << 'EOF'
net.core.rmem_max=16777216
net.core.rmem_default=16777216
net.core.wmem_max=16777216
net.core.wmem_default=16777216
net.core.netdev_max_backlog=5000
net.ipv4.udp_mem=65536 131072 262144
net.core.optmem_max=25165824
net.ipv4.udp_rmem_min=8192
net.ipv4.udp_wmem_min=8192
EOF
sysctl --system

echo "=== Setting up swap (2GB) ==="
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "Swap created and persisted."
else
    echo "Swap already exists, skipping."
fi

echo "=== Done. Reconnect SSH to apply docker group membership ==="
