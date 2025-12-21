#!/usr/bin/env python3
"""Run Alembic migration programmatically.

USAGE:
    cd app && python run_migration.py

PREREQUISITES:
    1. Ensure docker/.env has POOLER_TENANT_ID=launchpad
    2. Ensure app/.env has DATABASE_USER=postgres.launchpad
    3. Restart Supavisor if tenant config changed:
       cd docker && docker-compose restart supavisor

This script attempts multiple connection strategies to apply the migration.
"""
import sys
import os

# Ensure we're in the right directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '.')

def run_migration_with_url(db_url):
    """Attempt migration with a specific database URL."""
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config('alembic.ini')
    alembic_cfg.set_main_option('sqlalchemy.url', db_url)

    command.upgrade(alembic_cfg, 'head')
    return True

def main():
    # Get password from environment
    from dotenv import load_dotenv
    load_dotenv()

    db_password = os.getenv('DATABASE_PASSWORD', 'your-super-secret-and-long-postgres-password')

    # Connection attempts to try in order
    connection_attempts = [
        # 1. Try port 6543 (Supavisor transaction mode) with tenant user
        ("Port 6543 (transaction mode)", f"postgresql://postgres.launchpad:{db_password}@localhost:6543/postgres"),
        # 2. Try port 5432 with tenant user (standard Supavisor)
        ("Port 5432 (session mode)", f"postgresql://postgres.launchpad:{db_password}@localhost:5432/postgres"),
        # 3. Try with IPv4 explicitly
        ("Port 5432 via 127.0.0.1", f"postgresql://postgres.launchpad:{db_password}@127.0.0.1:5432/postgres"),
    ]

    for desc, url in connection_attempts:
        print(f"Trying: {desc}...")

        try:
            run_migration_with_url(url)
            print(f'\n✓ Migration applied successfully via {desc}!')
            return 0
        except Exception as e:
            error_str = str(e)
            if 'Tenant or user not found' in error_str:
                print(f"  ✗ Supavisor tenant not initialized")
            elif 'Connection refused' in error_str:
                print(f"  ✗ Connection refused")
            elif 'password authentication failed' in error_str:
                print(f"  ✗ Authentication failed")
            else:
                print(f"  ✗ Error: {error_str[:80]}...")
            continue

    print("\n" + "=" * 60)
    print("MIGRATION BLOCKED: Supavisor tenant not initialized")
    print("=" * 60)
    print("\nTo fix this, run the following commands:")
    print("\n  1. Restart Supavisor to initialize tenant:")
    print("     cd docker && docker-compose restart supavisor")
    print("\n  2. Wait a few seconds for Supavisor to start")
    print("\n  3. Run migration:")
    print("     cd app && alembic upgrade head")
    print("\n  OR run this script again:")
    print("     cd app && python run_migration.py")
    print("\n" + "=" * 60)
    return 1

if __name__ == '__main__':
    sys.exit(main())
