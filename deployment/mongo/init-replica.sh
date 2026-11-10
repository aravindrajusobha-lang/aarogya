#!/bin/bash
# =========================================================================
# MongoDB Replica Set Initializer for Docker Compose
# Waits for primary mongod to accept connections, then executes rs.initiate()
# =========================================================================

set -e

echo "Waiting for MongoDB instance on mongo:27017..."

until mongosh --host mongo:27017 --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; do
  sleep 1
done

echo "MongoDB is reachable. Initializing single-node replica set rs0..."

mongosh --host mongo:27017 --quiet <<EOF
try {
  var status = rs.status();
  print("Replica set already initialized with status: " + status.ok);
} catch (e) {
  print("Initiating replica set rs0...");
  rs.initiate({
    _id: "rs0",
    members: [
      { _id: 0, host: "mongo:27017" }
    ]
  });
}
EOF

echo "Replica set rs0 initialized successfully."
