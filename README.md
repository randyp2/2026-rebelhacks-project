📄 Product Requirements Document (Final)
SafeStay AI
1️⃣ Product Overview
🎯 Goal

Build a privacy-safe, multi-signal anomaly detection system for Las Vegas hotels that aggregates operational metadata and computer vision–derived activity signals to generate real-time room-level risk scores.

The system:

Does not identify individuals

Detects behavioral patterns across multiple signals

Flags anomalies that warrant human review

2️⃣ Problem Statement

In Las Vegas:

High staff turnover reduces institutional knowledge

Red flags often look “normal” (cash payments, late-night traffic)

Incidents are fragmented across properties

Detection relies heavily on human intuition

Single signals are weak indicators

Solution Approach:
Correlate multiple weak signals into stronger anomaly patterns.

3️⃣ Solution Overview

SafeStay AI combines:

Synthetic hotel operational signals

Computer vision–derived analytics for linen tracking and human-verified timestamped footage during keycard usage

Weighted risk scoring engine

Real-time visualization dashboard

One signal = normal
Multiple correlated signals over time = anomaly

4️⃣ Core Features
4.1 Multi-Signal Risk Engine
Signals Tracked
Operational Metadata

Short-duration bookings

Same payment token across rooms (hashed only)

Excessive keycard resets

Frequent linen/towel requests

Housekeeping refusal with supply requests

Computer Vision Metadata

Linen request detection

Person count near room doorway

Entry frequency per hour

Time-of-day traffic spikes

Functional Requirements
Requirement	Obstacle?	Notes
Store hotel events	❌ No	Standard Postgres tables
Store CV metadata	❌ No	No video storage
Weighted scoring logic	❌ No	Edge function
Rolling time-window aggregation	⚠️ Moderate	Requires careful query design
Threshold-based alerts	❌ No	Simple logic
Real-time UI updates	❌ No	Supabase Realtime
5️⃣ Computer Vision Specification
🎥 What the Camera Records

The system does not store video footage.

It extracts and stores only:

Person count

Entry frequency

Timestamp

Room zone

Example Stored Record
room_id: 304
timestamp: 2026-03-01T01:32:00
person_count: 3
entries_last_hour: 12
🚫 What It Does NOT Record

Faces

Identity

Biometrics

Audio

Images

Demographic attributes

CV Pipeline

YOLOv8 detects “person” objects

Bounding boxes counted

Room zone mapped

Metadata generated

Frames discarded

Metadata sent to Supabase

6️⃣ Risk Scoring Model
Scoring Formula
Risk Score = Σ(weight × frequency × time_decay)
Example Weights
Signal	Weight
Short stay	2
Linen spike	3
Key resets	3
CV traffic anomaly	5
7️⃣ Technical Architecture
Stack
Frontend

Next.js (App Router)

Recharts

Supabase Realtime

Backend

Supabase (Postgres + Auth + Realtime)

Supabase Edge Functions (risk scoring)

REST endpoint for CV ingestion

Computer Vision

Python

YOLOv8

OpenCV

8️⃣ Database Schema (Updated)
hotel_events

Stores operational hotel event data tied to a room and guest.

id

room_id

guest_name

event_type

value

timestamp

cv_events

id

room_id

person_count

entry_count

timestamp

room_risk

room_id

risk_score

last_updated

alerts

room_id

risk_score

explanation

timestamp

persons

Stores unique individuals who have booked rooms.

id

full_name

last_room_purchase_timestamp

person_room_history

Tracks historical room purchases and whether the room was flagged at the time.

id

person_id (FK → persons.id)

room_id

purchase_timestamp

was_flagged_dangerous (boolean)

risk_score_at_time

Design Notes

persons enables longitudinal tracking across stays.

person_room_history preserves the historical risk state at time of booking.

was_flagged_dangerous ensures explainability and auditability.

No biometric or facial data is stored.

9️⃣ Testing Strategy (Hackathon)

Because real hotel data is inaccessible:

We will:

Generate statistically realistic synthetic hotel data

Pre-run YOLO on hallway footage

Store detection metadata

Replay event stream live during demo

🔟 Ethical & Legal Positioning

The system:

Does not perform facial recognition

Does not store biometric data

Detects behavioral anomalies only

Requires human review before action

🏁 Final Positioning

SafeStay AI is a privacy-safe behavioral anomaly detection platform that:

Aggregates multiple weak signals

Uses computer vision responsibly

Generates explainable risk patterns

Operates without identity tracking

Built With

Next.js + Supabase + YOLO
