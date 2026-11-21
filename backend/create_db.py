import os
import pymysql
from dotenv import load_dotenv

# Load env variables from backend/.env
load_dotenv()

def main():
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = int(os.getenv("DB_PORT", "3306"))
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "")
    db_name = os.getenv("DB_NAME", "invoicedb")

    print(f"Connecting to MySQL server at {host}:{port} as user '{user}'...")
    
    try:
        conn = pymysql.connect(
            host=host,
            port=port,
            user=user,
            password=password
        )
        try:
            with conn.cursor() as cursor:
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
            print(f"[OK] Database `{db_name}` created or already exists.")
        finally:
            conn.close()
    except Exception as e:
        print(f"Error creating database: {e}")
        print("Please ensure your MySQL server (XAMPP) is running.")
        return 1
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(main())

