# Frontend Integration Guide for `/edit` Endpoints

This guide details the new `GET` endpoints implemented specifically for populating update/edit forms across the admin features. Each endpoint retrieves precisely the data footprint necessary for the corresponding `PATCH` or `PUT` endpoint, stripping away eager-loaded relational data typically fetched when resolving full list layouts.

All the endpoints require the same authentication (JWT + Admin Role) as their corresponding update/create endpoints.

---

## 1. LMS Courses

### Course Edit Data
- **Endpoint:** `GET /v1/admin/courses/:uuid/edit`
- **Purpose:** Fetch the existing data to populate the **Edit Course** form.
- **Corresponding Update Route:** `PATCH /v1/admin/courses/:uuid`
- **Response Shape:**
  ```json
  {
    "title": "Introduction to Kangen",
    "description": "A comprehensive introductory course...",
    "thumbnailUrl": "https://example.com/thumb.jpg",
    "isFree": false,
    "price": 49.99
  }
  ```

### Section Edit Data
- **Endpoint:** `GET /v1/admin/courses/:courseUuid/sections/:sectionUuid/edit`
- **Purpose:** Fetch existing data to populate the **Edit Section** form.
- **Corresponding Update Route:** `PATCH /v1/admin/courses/:courseUuid/sections/:sectionUuid`
- **Response Shape:**
  ```json
  {
    "title": "Welcome Module",
    "order": 1
  }
  ```

### Lesson Edit Data
- **Endpoint:** `GET /v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid/edit`
- **Purpose:** Fetch existing data to populate the **Edit Lesson** form.
- **Corresponding Update Route:** `PATCH /v1/admin/courses/:courseUuid/sections/:sectionUuid/lessons/:lessonUuid`
- **Response Shape:**
  ```json
  {
    "title": "What is Kangen Water?",
    "description": "Video lesson detailing the science...",
    "videoUrl": "https://vimeo.com/...",
    "videoDuration": 120,
    "textContent": "<p>Some text</p>",
    "pdfUrl": null,
    "order": 1,
    "isPublished": true
  }
  ```

---

## 2. Funnel CMS

### Section Edit Data
- **Endpoint:** `GET /v1/admin/funnel/sections/:uuid/edit`
- **Purpose:** Populates the Funnel Section settings.
- **Corresponding Update Route:** `PATCH /v1/admin/funnel/sections/:uuid`
- **Response Shape:**
  ```json
  {
    "name": "Phase 1: Onboarding",
    "description": "Start of the funnel",
    "order": 1,
    "isActive": true
  }
  ```

### Step Settings Data
- **Endpoint:** `GET /v1/admin/funnel/steps/:uuid/edit`
- **Purpose:** Populates the basic step layout settings (typically just order and toggle status, skipping deep widget configs).
- **Corresponding Update Route:** `PATCH /v1/admin/funnel/steps/:uuid`
- **Response Shape:**
  ```json
  {
    "order": 2,
    "isActive": true
  }
  ```

### Step Content Data (for Video/Text step)
- **Endpoint:** `GET /v1/admin/funnel/steps/:uuid/content/edit`
- **Purpose:** Populates the Video/Text widget configuration.
- **Corresponding Update Route:** `PUT /v1/admin/funnel/steps/:uuid/content`
- **Response Shape:**
  ```json
  {
    "title": "Welcome to the funnel",
    "description": "Short description",
    "videoUrl": "https://vimeo.com/...",
    "videoDuration": 300,
    "thumbnailUrl": null,
    "textContent": "...",
    "requireVideoCompletion": true
  }
  ```

### Phone Gate Data
- **Endpoint:** `GET /v1/admin/funnel/steps/:uuid/phone-gate/edit`
- **Purpose:** Populates phone verification step configurations.
- **Corresponding Update Route:** `PUT /v1/admin/funnel/steps/:uuid/phone-gate`
- **Response Shape:**
  ```json
  {
    "title": "Verify your phone number",
    "subtitle": "We will send an OTP",
    "isActive": true
  }
  ```

### Payment Gate Data
- **Endpoint:** `GET /v1/admin/funnel/steps/:uuid/payment-gate/edit`
- **Purpose:** Populates payment gateway configurations.
- **Corresponding Update Route:** `PUT /v1/admin/funnel/steps/:uuid/payment-gate`
- **Response Shape:**
  ```json
  {
    "title": "Unlock content",
    "subtitle": "Pay commitment fee",
    "amount": 99.99,
    "currency": "INR",
    "allowCoupons": true,
    "isActive": true
  }
  ```

### Decision Step Data
- **Endpoint:** `GET /v1/admin/funnel/steps/:uuid/decision/edit`
- **Purpose:** Populates Yes/No decision fork configs.
- **Corresponding Update Route:** `PUT /v1/admin/funnel/steps/:uuid/decision`
- **Response Shape:**
  ```json
  {
    "question": "Are you interested in buying a Kangen machine?",
    "yesLabel": "Yes, I am interested!",
    "noLabel": "Not right now",
    "yesSubtext": "Takes 2 mins",
    "noSubtext": "Maybe later"
  }
  ```

---

## 3. Coupons

### Coupon Edit Data
- **Endpoint:** `GET /v1/admin/coupons/:uuid/edit`
- **Purpose:** Fetches the modifiable state for existing coupons. NOTE: To prevent auditing edge-cases, the API intentionally prevents editing the core coupon values (`code`, `type`, `value`, `applicableTo`) after creation.
- **Corresponding Update Route:** `PATCH /v1/admin/coupons/:uuid`
- **Response Shape:**
  ```json
  {
    "isActive": true,
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "usageLimit": 100
  }
  ```

---
> **NOTE:** For toggles, status checks, publishing switches, or array-reorders, an explicit `GET /edit` does not exist because the UI handles those states through lists/grids. Only explicit resource editors require fetching form-data footprint payload mapping.
