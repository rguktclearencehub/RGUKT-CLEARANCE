import requests

project_id = 'rguktclearencehu'
base_url = f'https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents'

def set_maintenance_fee(student_id, fee):
    url = f"{base_url}/maintenanceFees/{student_id}"
    payload = {
        'fields': {
            'pendingFee': {'integerValue': fee}
        }
    }
    # Use PATCH to create or update the document with updateMask
    res = requests.patch(url + "?updateMask.fieldPaths=pendingFee", json=payload)
    if res.status_code == 200:
        print(f"Set maintenance fee for {student_id} to {fee}")
    else:
        print(f"Failed to set fee: {res.text}")

if __name__ == '__main__':
    set_maintenance_fee('R240384', 1500)
