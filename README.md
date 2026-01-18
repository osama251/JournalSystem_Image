# JournalSystem_Image

Image handling microservice for the larger **JournalSystem** project.  
Responsible for **uploading, storing, and retrieving medical images**, along with related metadata.

This service stores **image files** and persists **image information in MySQL**, and is designed to run as part of a Docker/Kubernetes-based microservices architecture.

---

## Features

- Upload medical images
- Store image metadata in MySQL
- Retrieve images by ID or related entity
- Support for binary image storage
- REST API for image management
- Containerized with Docker
- Deployable with Kubernetes

---

## Tech Stack

- **JavaScript (Node.js)**
- **Express.js** (REST API)
- **MySQL** (image metadata persistence)
- **Docker**
- **Kubernetes (k3s)**

---

## Architecture (high level)

- REST API built with **Express**
- MySQL stores:
  - Image metadata (IDs, relations, timestamps, etc.)
- Image files are stored on disk
- Designed to be consumed by other backend services and the frontend

This service is intentionally isolated to keep image handling concerns separate from business logic.

---

## Kubernetes

- Deployed as part of the project’s Kubernetes (k3s) cluster
- Uses persistent volumes for image storage
- Deployment manifests are maintained in **JournalSystem_Q8SFILES**

