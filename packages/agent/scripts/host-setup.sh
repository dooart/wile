#!/bin/bash
# Host-level setup for EC2 instances running Wile
# These settings cannot be configured inside Docker containers
# Run this script on EC2 UserData or manually on the host

set -e

echo "=== Wile Host Setup ==="

# Configure swap (8GB)
echo "Configuring 8GB swap..."
fallocate -l 8G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Set vm.swappiness to 10 (prefer RAM, swap only when needed)
echo "Setting vm.swappiness=10..."
sysctl -w vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf

# Enable zswap with lz4 compression (3x effective swap, faster access)
echo "Enabling zswap with lz4..."
echo lz4 > /sys/module/zswap/parameters/compressor
echo 1 > /sys/module/zswap/parameters/enabled

# Install and enable earlyoom (prevents hard freeze)
echo "Installing earlyoom..."
apt-get update
apt-get install -y earlyoom
systemctl enable earlyoom
systemctl start earlyoom

echo "=== Host setup complete ==="
