"""Every new item needs a free pre-printed tag."""


def next_tags(client, quantity=1):
    response = client.post("/tags/batches", json={"quantity": quantity})
    assert response.status_code == 201, response.text
    return [tag["code"] for tag in response.json()["tags"]]


def next_tag(client):
    return next_tags(client)[0]
