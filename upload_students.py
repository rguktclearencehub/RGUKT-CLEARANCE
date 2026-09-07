import pandas as pd
import requests
import sys

def upload_students(excel_path):
    df = pd.read_excel(excel_path)
    # clean nan
    df = df.fillna('')
    
    records = df.to_dict(orient='records')
    url = 'https://firestore.googleapis.com/v1/projects/rguktclearencehu/databases/(default)/documents/students'
    
    success_count = 0
    for record in records:
        fields = {}
        for k, v in record.items():
            fields[k] = {'stringValue': str(v)}
            
        payload = {'fields': fields}
        import time
        max_retries = 3
        for attempt in range(max_retries):
            try:
                res = requests.post(url, json=payload, timeout=10)
                if res.status_code == 200:
                    success_count += 1
                    break
                else:
                    print(f"Failed to insert {record.get('Collage ID', 'Unknown')}: {res.text}")
                    break
            except Exception as e:
                print(f"Attempt {attempt + 1} failed for {record.get('Collage ID', 'Unknown')}: {e}")
                time.sleep(1)
        time.sleep(0.2)
            
    print(f"Successfully uploaded {success_count} out of {len(records)} students.")

if __name__ == '__main__':
    upload_students(r'c:\Users\bilij\Documents\RGUKT CLEARENCE HUB\student data.xlsx')
