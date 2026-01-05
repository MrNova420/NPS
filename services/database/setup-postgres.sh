#!/data/data/com.termux/files/usr/bin/bash
# PostgreSQL Setup for Android Server

set -e

echo "Setting up PostgreSQL on Android..."

# Initialize database
if [ ! -d "$PREFIX/var/lib/postgresql" ]; then
    echo "Initializing PostgreSQL database..."
    mkdir -p $PREFIX/var/lib/postgresql
    initdb $PREFIX/var/lib/postgresql
fi

# Create data directory
mkdir -p ~/server/data/postgres

# Configure PostgreSQL
cat > $PREFIX/var/lib/postgresql/postgresql.conf << EOF
# PostgreSQL configuration for Android
listen_addresses = 'localhost'
port = 5432
max_connections = 20
shared_buffers = 128MB
effective_cache_size = 512MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.7
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
work_mem = 6553kB
min_wal_size = 1GB
max_wal_size = 2GB
EOF

echo "PostgreSQL setup complete!"
echo ""
echo "Start PostgreSQL: pg_ctl -D \$PREFIX/var/lib/postgresql start"
echo "Stop PostgreSQL: pg_ctl -D \$PREFIX/var/lib/postgresql stop"
echo "Create database: createdb mydb"
echo "Connect: psql mydb"
