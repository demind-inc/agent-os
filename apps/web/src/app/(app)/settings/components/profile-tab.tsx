"use client";

import Link from "next/link";
import type { Profile } from "../types";
import { formatRole } from "../utils";

type ProfileTabProps = {
  profile: Profile;
  initials: string;
  firstName: string;
  lastName: string;
  saving: boolean;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onSave: (e: React.FormEvent) => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  deleting: boolean;
};

export function ProfileTab({
  profile,
  initials,
  firstName,
  lastName,
  saving,
  onFirstNameChange,
  onLastNameChange,
  onSave,
  onLogout,
  onDeleteAccount,
  deleting,
}: ProfileTabProps) {
  return (
    <>
      <section className="settingsPage__avatarSection">
        <div
          className="settingsPage__avatar"
          title={profile.full_name || profile.email}
        >
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="settingsPage__avatarImg"
            />
          ) : (
            <span className="settingsPage__avatarInitials">{initials}</span>
          )}
        </div>
        <div className="settingsPage__avatarInfo">
          <span className="settingsPage__avatarName">
            {profile.full_name || profile.email}
          </span>
          <span className="settingsPage__avatarEmail">{profile.email}</span>
          <span className="settingsPage__avatarRole">
            {formatRole(profile.role)}
          </span>
        </div>
        <button
          type="button"
          className="settingsPage__avatarUpload"
          disabled
          aria-label="Change photo"
        >
          <span
            className="settingsPage__avatarUploadIcon"
            aria-hidden
          />
          Change photo
        </button>
      </section>

      <form className="settingsPage__form" onSubmit={onSave}>
        <div className="settingsPage__formRow">
          <div className="settingsPage__formField">
            <label
              className="settingsPage__formLabel"
              htmlFor="firstName"
            >
              First name
            </label>
            <input
              id="firstName"
              type="text"
              className="settingsPage__formInput"
              value={firstName}
              onChange={(e) => onFirstNameChange(e.target.value)}
            />
          </div>
          <div className="settingsPage__formField">
            <label
              className="settingsPage__formLabel"
              htmlFor="lastName"
            >
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              className="settingsPage__formInput"
              value={lastName}
              onChange={(e) => onLastNameChange(e.target.value)}
            />
          </div>
        </div>
        <div className="settingsPage__formField">
          <label className="settingsPage__formLabel">Email address</label>
          <div className="settingsPage__formInput settingsPage__formInput--readOnly">
            {profile.email}
          </div>
        </div>
        <div className="settingsPage__formField">
          <label className="settingsPage__formLabel">Role</label>
          <div className="settingsPage__formInput settingsPage__formInput--readOnly">
            {formatRole(profile.role)}
          </div>
        </div>
        <div className="settingsPage__actions">
          <Link
            href="/app"
            className="settingsPage__btn settingsPage__btn--secondary"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="settingsPage__btn settingsPage__btn--primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div className="settingsPage__logoutSection">
        <button
          type="button"
          className="settingsPage__logoutBtn"
          onClick={onLogout}
        >
          <span className="settingsPage__logoutIcon" aria-hidden />
          Log out
        </button>
      </div>

      <div className="settingsPage__dangerSection">
        <h3 className="settingsPage__dangerTitle">
          Testing: Delete account
        </h3>
        <p className="settingsPage__dangerText">
          Permanently remove your profile and auth user. All your data
          will be deleted.
        </p>
        <button
          type="button"
          className="settingsPage__deleteAccountBtn"
          onClick={onDeleteAccount}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "Delete account"}
        </button>
      </div>
    </>
  );
}
