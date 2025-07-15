# TabCura

TabCura is a cloud-native healthcare platform that streamlines patient management, appointment scheduling, and medical data access. Built with Java Spring Boot (backend) and React (frontend), TabCura offers a scalable solution for modern healthcare providers.
Live Demo
Check out the live app here:
👉 TabCura – http://20.82.88.51:3000/


## 🚀 Features

- 🧾 Secure patient records management
- 🗓️ Doctor appointment scheduling
- 📊 Dashboard for admin/staff insights
- 🔐 Role-based authentication and access control
- ☁️ Deployed on Azure (AKS/ACI/VM)
- 🐳 Dockerized for easy deployment

## 🛠️ Tech Stack

### Frontend
- React
- HTML, CSS, Tailwind
- Axios for API calls

### Backend
- Java Spring Boot
- Maven
- RESTful APIs

### DevOps
- Docker
- Azure DevOps Pipelines
- Azure Container Registry (ACR)
- Azure Kubernetes Service (AKS) / Azure VMs

### Database
- MySQL / PostgreSQL (Configurable)

## 📁 Project Structure


## ⚙️ Setup Instructions

### Prerequisites

- Java 17+
- Node.js 18+
- Maven
- Docker
- Azure CLI (for cloud deployment)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/TabCura.git
cd TabCura
cd backend
mvn clean install
java -jar target/*.jar
cd frontend
npm install
npm start
cd backend
docker build -t tabcura-backend .
docker run -p 8080:8080 tabcura-backend
cd frontend
docker build -t tabcura-frontend .
docker run -p 3000:3000 tabcura-frontend
Azure Deployment Overview
Build and push images to Azure Container Registry (ACR)

Deploy using Azure Kubernetes Service (AKS) or Azure VM

Setup CI/CD using Azure DevOps pipelines
CI/CD Pipeline Highlights
Automated build & push of Docker images

Deploy backend to AKS or Azure VMs

Frontend deployment using Nginx/React static build

