# Worship Flow Feature Roadmap
This document is the long-term product roadmap for Worship Flow.

It is written for both:

* humans who need a quick, readable overview of planned product work
* AI agents and developers who need structured, explicit feature intent

## How to Read This Document

Each version section contains roadmap items with the same structure:

* `Feature`: short name of the initiative
* `Goal`: what the feature should accomplish
* `Scope`: what is included in the release
* `Notes`: constraints, dependencies, or implementation guidance

## Product Context

Worship Flow is a worship-service preparation platform.

Core focus areas:

* worship service planning
* service templates and ordered blocks
* participant coordination
* song and media preparation workflows
* operational settings and church team management

Out of scope unless explicitly approved elsewhere:

* general church management
* social features
* recurring events
* broad event scheduling

\---

## Version 1.1

### Feature: Settings Page Restructure

**Goal**
Improve the Settings page so it is easier to navigate and maintain.

**Scope**

* Rework the Settings page UI/UX.
* Organize Settings into tabs:

  * General
  * Templates
  * Tags
  * Checklist

**Notes**

* The tab structure should be stable enough to support future settings growth.
* The interface should stay aligned with the app's production-oriented workflow.

### Feature: Centralized Checklist Management

**Goal**
Make the Settings page the source of truth for checklist configuration.

**Scope**

* Connect the Settings checklist to the Dashboard checklist.
* Show the checklist in Dashboard as read-only.
* Allow checklist editing only in Settings.

**Notes**

* Dashboard should reflect the latest checklist configuration without becoming an editing surface.
* This preserves configuration control while keeping Dashboard focused on execution.

### Feature: General Settings Expansion

**Goal**
Make the General tab useful for operational visibility and account-related setup.

**Scope**

* Add AI usage visibility, including remaining credits if available.
* Add an Access Control area.
* Add an Integrations area for AI-related connections.

**Notes**

* Access Control may require moving away from a shared application username/password model.
* Integrations should support users connecting their own OpenAI accounts for AI-powered workflows.
* If AI credits are workspace-level, the UI should make that ownership clear.

\---

## Version 1.2

### Feature: Church Organization Data Model

**Goal**
Move the platform to an organization-based model so church data belongs to a church entity rather than a loose user grouping.

**Scope**

* Introduce a `ChurchOrganization` model.
* Associate users with one or more church organizations.
* Store current app data under the relevant church organization.

**Notes**

* This should become the main ownership boundary for application data.
* The model should support users who belong to multiple church organizations if needed.

### Feature: Account and Access Flow Overhaul

**Goal**
Support account-based access where users sign in as individuals and then access the church organizations they belong to.

**Scope**

* Replace the current shared-access approach with user accounts.
* Allow users to create their own accounts.
* Allow users to enter the church organizations they have access to.

**Notes**

* Access should be granted per church organization.
* This work is tightly linked to the Access Control area introduced in Settings.
* Security and membership flow should be designed for explicit invitation or approval, not implicit access.

### Feature: Church Organization Registration Workflow

**Goal**
Create a formal onboarding process before a church organization is activated in the system.

**Scope**

* Require churches to submit a registration request before an organization is created.
* Collect supporting information during registration:

  * church images
  * Google Maps location
  * lead pastor email or official church email
* Include a processing period before approval.

**Notes**

* The exact processing time is still to be defined and should later be replaced with a concrete service expectation.
* Registration should be treated as a review workflow, not immediate self-activation.

### Feature: Managed Access Control

**Goal**
Ensure access is granted intentionally after a user account exists.

**Scope**

* Require users to create an account before access is granted.
* Manage organization access through the Settings page Access Control section.

**Notes**

* Access Control should operate on top of the new account and church organization model.
* This should remain simple and avoid unnecessary RBAC complexity unless explicitly requested later.

\---

## Version 1.3

### Feature: UI/UX Overhaul

**Goal**
Refresh the overall product experience to feel more polished, modern, and production-ready.

**Scope**

* Improve the application's overall UI/UX.
* Add purposeful animations where they improve clarity or perceived quality.

**Notes**

* Animation should support usability, not distract from worship service preparation workflows.
* The redesign should stay aligned with the established Worship Flow visual system.
