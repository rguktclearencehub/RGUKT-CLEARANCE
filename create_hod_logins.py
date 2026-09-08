import requests
import json

API_KEY = "AIzaSyAwIxWKaS1dMhlNs6hRuIrGaZ2vjY9lXu4"
PROJECT_ID = "rguktclearencehu"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/users"
SIGNUP_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"

branches = ["AIML", "CSE", "ECE", "EEE", "CIVIL", "CHE", "ME", "MME"]

def create_hod_logins():
    for branch in branches:
        email = f"hod_{branch.lower()}@dept.rgukt.in"
        password = f"hod{branch.lower()}12345"
        
        print(f"Processing HOD for {branch}...")
        
        payload = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }
        res = requests.post(SIGNUP_URL, json=payload)
        
        uid = None
        if res.status_code == 200:
            data = res.json()
            uid = data['localId']
            print(f" - Created Auth user: {uid}")
        else:
            error_message = res.json().get('error', {}).get('message', '')
            if error_message == 'EMAIL_EXISTS':
                print(f" - User already exists in Auth: {email}")
                login_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
                l_res = requests.post(login_url, json={"email": email, "password": password, "returnSecureToken": True})
                if l_res.status_code == 200:
                    uid = l_res.json()['localId']
            else:
                print(f" - Failed to create Auth user: {res.text}")
                continue
                
        if uid:
            doc_url = f"{FIRESTORE_URL}/{uid}"
            get_res = requests.get(doc_url)
            
            if get_res.status_code == 404:
                create_url = f"{FIRESTORE_URL}?documentId={uid}"
                doc_payload = {
                    "fields": {
                        "email": {"stringValue": email},
                        "role": {"stringValue": "DEPARTMENT"},
                        "departmentName": {"stringValue": f"HOD {branch}"},
                        "name": {"stringValue": f"HOD {branch}"},
                        "createdAt": {"stringValue": "2024-01-01T00:00:00Z"}
                    }
                }
                f_res = requests.post(create_url, json=doc_payload)
                if f_res.status_code == 200:
                    print(f" - Created Firestore doc for HOD {branch}")
                else:
                    print(f" - Failed to create Firestore doc: {f_res.text}")
            elif get_res.status_code == 200:
                print(f" - Firestore doc already exists for HOD {branch}")
            else:
                print(f" - Error checking Firestore doc: {get_res.text}")

        print(f" => Credentials: {email} / {password}\n")

if __name__ == '__main__':
    create_hod_logins()
