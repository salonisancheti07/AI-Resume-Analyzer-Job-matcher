from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid
import json
import os
from datetime import datetime
from app.core.config import get_settings
from pymongo import MongoClient

# File fallback path
DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "applications.json")


def _ensure_data_file():
    dirpath = os.path.dirname(DATA_FILE)
    os.makedirs(dirpath, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _read_all_file():
    _ensure_data_file()
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_all_file(items):
    _ensure_data_file()
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


# Try MongoDB connection; fall back to file storage
_db_client = None
_applications_collection = None
try:
    settings = get_settings()
    if settings.mongo_uri:
        _db_client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=2000)
        try:
            # trigger server selection
            _db_client.server_info()
            # get default DB or fallback
            db = _db_client.get_default_database() if _db_client.get_default_database() is not None else _db_client["ai_resume"]
            _applications_collection = db["applications"]
        except Exception:
            _db_client = None
            _applications_collection = None
except Exception:
    _db_client = None
    _applications_collection = None


def _read_all():
    if _applications_collection:
        docs = list(_applications_collection.find().sort("created_at", -1))
        for d in docs:
            d["id"] = str(d.get("_id"))
            d.pop("_id", None)
        return docs
    return _read_all_file()


def _write_all(items):
    if _applications_collection:
        # replace collection contents (simple sync logic for small dataset)
        _applications_collection.delete_many({})
        if items:
            # convert ids to ObjectId if possible is not necessary; let Mongo assign
            for it in items:
                it_copy = dict(it)
                it_copy.pop("id", None)
                _applications_collection.insert_one(it_copy)
        return items
    _write_all_file(items)
    return items

class Application(BaseModel):
    id: Optional[str]
    job_title: str
    company: Optional[str] = None
    job_url: Optional[str] = None
    resume_version: Optional[str] = None
    status: Optional[str] = "Interested"  # Interested, Applied, Interviewing, Offer, Rejected
    notes: Optional[str] = None
    applied_at: Optional[str] = None
    created_at: Optional[str] = None


router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.get("/", response_model=List[Application])
def list_applications():
    items = _read_all()
    return items


@router.post("/", response_model=Application)
def create_application(payload: Application):
    now = datetime.utcnow().isoformat()
    item = payload.dict()
    item["created_at"] = now
    if item.get("applied_at") is None and item.get("status") == "Applied":
        item["applied_at"] = now
    if _applications_collection:
        res = _applications_collection.insert_one({k: v for k, v in item.items() if k != "id"})
        item["id"] = str(res.inserted_id)
        return item
    # file fallback
    items = _read_all()
    item["id"] = str(uuid.uuid4())
    items.append(item)
    _write_all(items)
    return item


@router.put("/{application_id}", response_model=Application)
def update_application(application_id: str, payload: Application):
    patch = payload.dict(exclude_unset=True)
    if _applications_collection:
        existing = _applications_collection.find_one({"_id": application_id})
        # try to find by string id in a stored field
        if not existing:
            # attempt search by id string field
            existing = _applications_collection.find_one({"id": application_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Application not found")
        # if status moves to Applied, set applied_at
        if existing.get("status") != "Applied" and patch.get("status") == "Applied":
            patch["applied_at"] = datetime.utcnow().isoformat()
        _applications_collection.update_one({"_id": existing.get("_id")}, {"$set": patch})
        updated = _applications_collection.find_one({"_id": existing.get("_id")})
        updated["id"] = str(updated.get("_id"))
        updated.pop("_id", None)
        return updated

    items = _read_all()
    for i, it in enumerate(items):
        if it.get("id") == application_id:
            updated = {**it, **patch}
            # set applied_at when status moves to Applied
            if it.get("status") != "Applied" and updated.get("status") == "Applied":
                updated["applied_at"] = datetime.utcnow().isoformat()
            items[i] = updated
            _write_all(items)
            return updated
    raise HTTPException(status_code=404, detail="Application not found")


@router.delete("/{application_id}")
def delete_application(application_id: str):
    if _applications_collection:
        # try by ObjectId string or by id field
        res = _applications_collection.delete_many({"$or": [{"id": application_id}, {"_id": application_id}]})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Application not found")
        return {"deleted": application_id}

    items = _read_all()
    next_items = [it for it in items if it.get("id") != application_id]
    if len(next_items) == len(items):
        raise HTTPException(status_code=404, detail="Application not found")
    _write_all(next_items)
    return {"deleted": application_id}
