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
    # Every new asset must enter the inventory with a known physical location.
    location_id: int


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
    is_responsible: bool = False
    is_borrower: bool = True
    name: str
    email: str | None = None
    phone: str | None = None


class PersonUpdate(BaseModel):
    is_responsible: bool | None = None
    is_borrower: bool | None = None
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    active: bool | None = None


class PersonResponse(BaseModel):
    is_responsible: bool
    is_borrower: bool
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
    active: bool | None = None


class LocationResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    active: bool

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


class DeviceImageResponse(BaseModel):
    id: int
    device_id: int
    original_name: str
    content_type: str
    url: str
    uploaded_at: datetime


class DeviceLocationHistoryResponse(BaseModel):
    id: int
    device_id: int
    from_location_id: int | None = None
    from_location_name: str | None = None
    to_location_id: int
    to_location_name: str
    change_type: str
    changed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeviceTrackingResponse(BaseModel):
    device: DeviceResponse
    current_location: LocationResponse | None = None
    location_history: list[DeviceLocationHistoryResponse]
    images: list[DeviceImageResponse]


class AuditEventResponse(BaseModel):
    id: int
    event_type: str
    category: str
    severity: str
    entity_type: str | None = None
    entity_id: int | None = None
    device_id: int | None = None
    loan_id: int | None = None
    person_id: int | None = None
    location_id: int | None = None
    title: str
    description: str
    details_json: str | None = None
    occurred_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationResponse(BaseModel):
    id: int
    event_type: str
    severity: str
    title: str
    message: str
    device_id: int | None = None
    loan_id: int | None = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminClearDataRequest(BaseModel):
    code: str


class PublicAccessRequest(BaseModel):
    base_url: str


class DevicePublicAccessResponse(BaseModel):
    enabled: bool
    public_url: str
    public_path: str
    token: str
    qr_svg: str
    created_at: datetime | None = None
    regenerated_at: datetime | None = None


class PublicDeviceResponse(BaseModel):
    code: str
    name: str
    category: str
    serial_number: str | None = None
    status: str
    description: str | None = None
    location_name: str | None = None
    location_description: str | None = None
    image_url: str | None = None
    image_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None
