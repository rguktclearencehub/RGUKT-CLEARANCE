import requests
import json
import time

project_id = 'rguktclearencehu'
base_url = f'https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents'

def get_documents(collection_id):
    url = f"{base_url}/{collection_id}"
    res = requests.get(url)
    if res.status_code == 200:
        return res.json().get('documents', [])
    return []

def fix_users():
    users = get_documents('users')
    students_excel = get_documents('students')
    
    excel_data = {}
    for doc in students_excel:
        fields = doc.get('fields', {})
        if 'Collage ID' in fields:
            cid = fields['Collage ID'].get('stringValue', '').upper()
            name = fields.get('Name', {}).get('stringValue', '')
            if cid:
                excel_data[cid] = name
                
    for user_doc in users:
        fields = user_doc.get('fields', {})
        email = fields.get('email', {}).get('stringValue', '')
        if email and ('@rgukt' in email.lower()):
            user_id = email.split('@')[0].upper()
            if user_id in excel_data:
                correct_name = excel_data[user_id]
                
                # Update users doc
                doc_name = user_doc['name']
                update_url = f"https://firestore.googleapis.com/v1/{doc_name}?updateMask.fieldPaths=name"
                payload = {
                    "fields": {
                        "name": {"stringValue": correct_name},
                        "email": fields.get("email"),
                        "role": fields.get("role"),
                        "createdAt": fields.get("createdAt")
                    }
                }
                requests.patch(update_url, json=payload)
                print(f"Updated user name for {email} to {correct_name}")
                
                # Update students doc
                uid = doc_name.split('/')[-1]
                student_doc_url = f"{base_url}/students/{uid}"
                s_res = requests.get(student_doc_url)
                if s_res.status_code == 200:
                    s_fields = s_res.json().get('fields', {})
                    update_s_url = f"https://firestore.googleapis.com/v1/{s_res.json()['name']}?updateMask.fieldPaths=studentId"
                    s_payload = {
                        "fields": {
                            "userId": s_fields.get("userId"),
                            "studentId": {"stringValue": user_id},
                            "program": s_fields.get("program"),
                            "year": s_fields.get("year")
                        }
                    }
                    requests.patch(update_s_url, json=s_payload)
                    print(f"Updated studentId for {email} to {user_id}")
                    
if __name__ == '__main__':
    fix_users()
