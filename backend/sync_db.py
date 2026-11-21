"""Database Synchronizer script.

Copies all schema tables and rows from the local database configuration
to the target remote database configuration.
"""
import os
import pymysql
from dotenv import load_dotenv

# Load local environment config
load_dotenv()

# LOCAL DATABASE connection config (source)
LOCAL_DB = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "",
    "database": "invoicedb"
}

# REMOTE DATABASE connection config (destination)
# Reads values from backend/.env
REMOTE_DB = {
    "host": os.getenv("DB_HOST", "187.127.170.108"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "invoice"),
    "password": os.getenv("DB_PASSWORD", "djU2sPWF9mMsTBWq4CsgTribqDU8rJHoPdZBkvukMtxtFf830jQfcfpw23wNzLWj"),
    "database": os.getenv("DB_NAME", "invoice")
}

def sync_database():
    print(f"Connecting to LOCAL Database ({LOCAL_DB['host']}/{LOCAL_DB['database']})...")
    try:
        local_conn = pymysql.connect(
            host=LOCAL_DB["host"],
            port=LOCAL_DB["port"],
            user=LOCAL_DB["user"],
            password=LOCAL_DB["password"],
            database=LOCAL_DB["database"],
            cursorclass=pymysql.cursors.DictCursor
        )
    except Exception as e:
        print(f"ERROR connecting to local DB: {e}")
        return

    print(f"Connecting to REMOTE VPS Database ({REMOTE_DB['host']}/{REMOTE_DB['database']})...")
    try:
        remote_conn = pymysql.connect(
            host=REMOTE_DB["host"],
            port=REMOTE_DB["port"],
            user=REMOTE_DB["user"],
            password=REMOTE_DB["password"],
            database=REMOTE_DB["database"]
        )
    except Exception as e:
        print(f"ERROR connecting to remote DB: {e}")
        local_conn.close()
        return

    tables = [
        "roles", "users", "clients", "categories", "services", 
        "projects", "quotations", "invoices", "payments", 
        "company_settings", "smtp_settings", "activity_logs", "notifications"
    ]

    try:
        with local_conn.cursor() as src, remote_conn.cursor() as dest:
            # Disable foreign key checks temporarily to allow overwrite
            dest.execute("SET FOREIGN_KEY_CHECKS = 0;")
            
            for table in tables:
                print(f"Syncing table: {table}...")
                
                # 1. Fetch data from source
                src.execute(f"SELECT * FROM `{table}`")
                rows = src.fetchall()
                if not rows:
                    print(f"  No records found in local table '{table}'. Skipping.")
                    continue
                
                # 2. Clear destination table
                dest.execute(f"TRUNCATE TABLE `{table}`")
                
                # 3. Generate dynamic INSERT statement
                columns = list(rows[0].keys())
                placeholders = ", ".join(["%s"] * len(columns))
                sql = f"INSERT INTO `{table}` ({', '.join([f'`{c}`' for c in columns])}) VALUES ({placeholders})"
                
                # 4. Write data to destination
                data = [tuple(row[col] for col in columns) for row in rows]
                dest.executemany(sql, data)
                print(f"  Successfully copied {len(rows)} rows into remote table '{table}'!")
                
            dest.execute("SET FOREIGN_KEY_CHECKS = 1;")
            remote_conn.commit()
            print("\n🎉 DATABASE SYNC COMPLETED SUCCESSFULLY!")
    except Exception as e:
        print(f"Error during synchronization: {e}")
        remote_conn.rollback()
    finally:
        local_conn.close()
        remote_conn.close()

if __name__ == "__main__":
    sync_database()
