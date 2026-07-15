from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import shutil
import os

from db import get_db, User, create_db_and_tables  # see db.py below

SECRET_KEY = "CHANGE_THIS_TO_A_RANDOM_SECRET"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60*24*7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

router = APIRouter(prefix="/api", tags=["auth"])

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    name: str
    gender: str
    email: str
    mobile: str
    date_of_birth: str
    password: str
    profile_photo: Optional[UploadFile] = None

class UserOut(BaseModel):
    id: int
    name: str
    gender: str
    email: str
    mobile: str
    date_of_birth: str
    age: int
    profile_photo: Optional[str]
    skin_colour: Optional[str]
    face_type: Optional[str]
    hair_type: Optional[str]

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/signup", response_model=Token)
async def signup(
    name: str = Form(...),
    gender: str = Form(...),
    email: str = Form(...),
    mobile: str = Form(...),
    date_of_birth: str = Form(...),
    password: str = Form(...),
    profile_photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(password)
    dob = datetime.strptime(date_of_birth, "%Y-%m-%d").date()
    today = datetime.today().date()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    photo_path = None
    if profile_photo:
        # Save uploaded photo
        fname = f"uploads/{email}_{profile_photo.filename}"
        with open(fname, "wb") as buffer:
            shutil.copyfileobj(profile_photo.file, buffer)
        photo_path = fname
    user = User(
        name=name, gender=gender, email=email, mobile=mobile, date_of_birth=dob,
        password=hashed, age=age, profile_photo=photo_path
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"user_id": user.id}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"user_id": user.id}, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": token, "token_type": "bearer"}

@router.get("/profile", response_model=UserOut)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/update_scan")
def update_scan(face_type: str, hair_type: str, skin_colour: str,
                current_user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    current_user.face_type = face_type
    current_user.hair_type = hair_type
    current_user.skin_colour = skin_colour
    db.commit()
    return {"message": "Profile updated"}

# You need to include: from . import db in your main FastAPI app script and call create_db_and_tables() on startup