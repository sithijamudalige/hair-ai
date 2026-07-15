from sqlalchemy import Column, Integer, String, Date, create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.types import Date as SQLDate

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    gender = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    mobile = Column(String)
    date_of_birth = Column(SQLDate)
    age = Column(Integer)
    profile_photo = Column(String, nullable=True)
    skin_colour = Column(String, nullable=True)
    face_type = Column(String, nullable=True)
    hair_type = Column(String, nullable=True)

DATABASE_URL = "sqlite:///./test.db"  # use Postgres for prod
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_db_and_tables():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()