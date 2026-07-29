#!/bin/bash

# Set your access token
TOKEN="YOUR_ACCESS_TOKEN"
BASE_URL="http://localhost:3000/api/jobs"

# Test create job
create_job() {
  curl -X POST "$BASE_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d @- << EOF
{
  "title": "React Developer Needed",
  "description": "Looking for React expert",
  "budgetMin": 500,
  "budgetMax": 1000,
  "category": "programming",
  "skillsRequired": ["React", "Redux"],
  "experienceLevel": "intermediate",
  "durationValue": 2,
  "durationUnit": "weeks"
}
EOF
}

# Run tests
echo "Creating job post..."
JOB_ID=$(create_job | jq -r '.data._id')

echo "Getting all jobs..."
curl "$BASE_URL?category=programming"

echo "Submitting proposal..."
curl -X POST "$BASE_URL/$JOB_ID/proposals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"coverLetter": "Interested!", "proposedAmount": 750}'
