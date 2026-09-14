from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DeviceBase(BaseModel):
    name: str
    category: str
    serial_number: str | None = None
    status: str = "AVAILABLE"
    location_id: int | None = None
    responsible_person_id: int | None = None
    description: str | None = None


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    serial_number: str | None = None
    status: str | None = None
    location_id: int | None = None
    responsible_person_id: int | None = None
    description: str | None = None


class DeviceResponse(DeviceBase):
    id: int
    code: str

    model_config = ConfigDict(from_attributes=True)


class PersonCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None


class PersonUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    active: bool | None = None


class PersonResponse(BaseModel):
    id: int
    name: str
    email: str | None = None
    phone: str | None = None
    active: bool

    model_config = ConfigDict(from_attributes=True)


class LocationCreate(BaseModel):
    name: str
    description: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class LocationResponse(BaseModel):
    id: int
    name: str
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class LoanCreate(BaseModel):
    device_id: int
    person_id: int


class LoanResponse(BaseModel):
    id: int
    device_id: int
    device_code: str | None = None
    device_name: str | None = None
    person_id: int
    person_name: str | None = None
    loan_date: datetime
    return_date: datetime | None = None
    status: str


class LogResponse(BaseModel):
    id: int
    device_id: int | None = None
    action: str
    old_value: str | None = None
    new_value: str | None = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
