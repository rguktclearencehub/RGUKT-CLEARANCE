import requests
import json
import time

API_KEY = "AIzaSyAwIxWKaS1dMhlNs6hRuIrGaZ2vjY9lXu4"
PROJECT_ID = "rguktclearencehu"
FIRESTORE_URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/users"
SIGNUP_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
SIGNIN_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
DELETE_URL = f"https://identitytoolkit.googleapis.com/v1/accounts:delete?key={API_KEY}"

def delete_user(email, password):
    try:
        # Sign in to get ID token
        res = requests.post(SIGNIN_URL, json={
            "email": email,
            "password": password,
            "returnSecureToken": True
        })
        if res.status_code == 200:
            id_token = res.json()["idToken"]
            local_id = res.json()["localId"]
            
            # Delete from auth
            del_res = requests.post(DELETE_URL, json={"idToken": id_token})
            if del_res.status_code == 200:
                print(f"Deleted auth user {email}")
            
            # Delete from firestore
            requests.delete(f"{FIRESTORE_URL}/{local_id}")
            print(f"Deleted firestore document for {email}")
        else:
            print(f"User {email} could not be signed in to delete. Might not exist.")
    except Exception as e:
        print(f"Error deleting user {email}: {e}")

hostels = [
    {"name": "Boys Hostel", "email": "boys_hostel@dept.rgukt.in", "password": "boys_hostel123"},
    {"name": "Girls Hostel", "email": "girls_hostel@dept.rgukt.in", "password": "girls_hostel123"},
]

def create_hostel_logins():
    # First attempt to delete old single hostel login
    delete_user("hostel@dept.rgukt.in", "hostel12345")
    
    for hostel in hostels:
        try:
            # Create user in Firebase Auth
            signup_payload = {
                "email": hostel["email"],
                "password": hostel["password"],
                "returnSecureToken": True
            }
            response = requests.post(SIGNUP_URL, json=signup_payload)
            data = response.json()
            
            if "error" in data and data["error"]["message"] == "EMAIL_EXISTS":
                print(f"User with email {hostel['email']} already exists.")
                # We can proceed to update Firestore by signing in to get localId
                signin_res = requests.post(SIGNIN_URL, json={
                    "email": hostel["email"],
                    "password": hostel["password"],
                    "returnSecureToken": True
                })
                if signin_res.status_code == 200:
                    local_id = signin_res.json()["localId"]
                else:
                    print(f"Could not sign in {hostel['email']}. Skipping Firestore update.")
                    continue
            elif "localId" in data:
                local_id = data["localId"]
                print(f"Successfully created auth user for {hostel['name']} (UID: {local_id})")
            else:
                print(f"Error creating user {hostel['email']}: {data}")
                continue
                
            # Add/Update user in Firestore
            firestore_payload = {
                "fields": {
                    "email": {"stringValue": hostel["email"]},
                    "name": {"stringValue": hostel["name"]},
                    "role": {"stringValue": "DEPARTMENT"},
                    "departmentName": {"stringValue": hostel["name"]},
                    "createdAt": {"timestampValue": "2024-01-01T00:00:00Z"}
                }
            }
            
            # Using patch to update or create
            fs_url = f"{FIRESTORE_URL}/{local_id}"
            fs_response = requests.patch(fs_url, json=firestore_payload)
            
            if fs_response.status_code == 200:
                print(f"Successfully added/updated {hostel['name']} to Firestore.")
            else:
                print(f"Failed to add {hostel['name']} to Firestore: {fs_response.json()}")
                
        except Exception as e:
            print(f"Exception processing {hostel['name']}: {str(e)}")

if __name__ == "__main__":
    create_hostel_logins()