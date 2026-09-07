import requests

project_id = 'rguktclearencehu'
base_url = f'https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents'

def get_documents(collection_id):
    url = f"{base_url}/{collection_id}"
    res = requests.get(url)
    if res.status_code == 200:
        return res.json().get('documents', [])
    return []

def delete_all(collection_id):
    docs = get_documents(collection_id)
    for doc in docs:
        name = doc['name']
        del_url = f"https://firestore.googleapis.com/v1/{name}"
        requests.delete(del_url)
        print(f"Deleted {name}")

if __name__ == '__main__':
    delete_all('clearanceRequests')
    delete_all('departmentClearances')
    print("All test clearance requests deleted.")
