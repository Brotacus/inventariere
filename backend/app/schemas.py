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


class LocationCreate(BaseModel):
    name: str
    description: str | None = None
