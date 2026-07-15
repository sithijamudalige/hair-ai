from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from authroute import router as auth_router
from db import create_db_and_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup code: create tables
    create_db_and_tables()
    yield
    # Shutdown code (if you need it) here

# 1. Create the app FIRST, with lifespan handler
app = FastAPI(lifespan=lifespan)

# 2. Add CORS middleware BEFORE routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # For dev: Use ["*"] ONLY if you want any origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Now include your routers
app.include_router(auth_router)