import requests
import json

API_KEY = "AIzaSyAwIxWKaS1dMhlNs6hRuIrGaZ2vjY9lXu4"
PROJECT_ID = "rguktclearencehu"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/users"
SIGNUP_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"

departments = [
  'Hostel', 'Sports', 'Physics Lab', 'Chemistry Lab', 'Biology Lab', 'Engg Labs',
  'COE', 'HOD', 'Library', 'IT Infra', 'Scholarship Office',
  'FO', 'AO', 'Director', 'Dean of Academics', 'DSW'
]

def create_department_logins():
    for dept in departments:
        # e.g., "Physics Lab" -> "physicslab@dept.rgukt.in"
        short_name = dept.lower().replace(' ', '')
        email = f"{short_name}@dept.rgukt.in"
        password = f"{short_name}12345"  # at least 6 chars
        
        print(f"Processing {dept}...")
        
        # 1. Sign up user
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
                # Optional: We could get the UID by signing in, but let's skip for now
                # or sign in to get the UID
                login_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
                l_res = requests.post(login_url, json={"email": email, "password": password, "returnSecureToken": True})
                if l_res.status_code == 200:
                    uid = l_res.json()['localId']
            else:
                print(f" - Failed to create Auth user: {res.text}")
                continue
                
        if uid:
            # 2. Check if Firestore doc exists, if not create it
            doc_url = f"{FIRESTORE_URL}/{uid}"
            get_res = requests.get(doc_url)
            
            if get_res.status_code == 404:
                # Create user document
                create_url = f"{FIRESTORE_URL}?documentId={uid}"
                doc_payload = {
                    "fields": {
                        "email": {"stringValue": email},
                        "role": {"stringValue": "DEPARTMENT"},
                        "departmentName": {"stringValue": dept},
                        "name": {"stringValue": dept + " Admin"},
                        "createdAt": {"stringValue": "2024-01-01T00:00:00Z"}
                    }
                }
                f_res = requests.post(create_url, json=doc_payload)
                if f_res.status_code == 200:
                    print(f" - Created Firestore doc for {dept}")
                else:
                    print(f" - Failed to create Firestore doc: {f_res.text}")
            elif get_res.status_code == 200:
                print(f" - Firestore doc already exists for {dept}")
            else:
                print(f" - Error checking Firestore doc: {get_res.text}")

        print(f" => Credentials: {email} / {password}\n")

if __name__ == '__main__':
    create_department_logins()
