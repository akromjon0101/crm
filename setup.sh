#!/bin/bash

echo "============================================"
echo "  EduCRM - Educational Center CRM Setup"
echo "============================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${YELLOW}Step 1: Setting up database...${NC}"
echo "Create the database manually if not done:"
echo "  createdb crm_db"
echo "  psql -U postgres -d crm_db -f database/schema.sql"
echo ""

echo -e "${YELLOW}Step 2: Installing backend dependencies...${NC}"
cd backend
npm install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

echo ""
echo -e "${YELLOW}Step 3: Setting up backend .env...${NC}"
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo -e "${GREEN}✓ .env created from .env.example — please edit it!${NC}"
else
  echo ".env already exists"
fi

echo ""
echo -e "${YELLOW}Step 4: Installing frontend dependencies...${NC}"
cd ../frontend
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

echo ""
echo -e "${GREEN}============================================"
echo "  Setup complete!"
echo "============================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env with your database credentials"
echo "  2. Run: psql -U postgres -d crm_db -f database/schema.sql"
echo "  3. Start backend:  cd backend && npm run dev"
echo "  4. Start frontend: cd frontend && npm start"
echo ""
echo "Login: superadmin@crm.uz / password"
