{
  "entities": {
    "User": {
      "title": "User",
      "description": "User profile with role information",
      "type": "object",
      "properties": {
        "uid": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "role": { "type": "string", "enum": ["店長", "AM", "BM"] },
        "storeName": { "type": "string" },
        "photoURL": { "type": "string" }
      },
      "required": ["uid", "email", "role"]
    }
  },
  "firestore": {
    "/users/{uid}": {
      "schema": { "$ref": "#/entities/User" },
      "description": "Stores user profile and role information"
    }
  }
}
