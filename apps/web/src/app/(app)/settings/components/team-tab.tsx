"use client";

import type { TeamMember } from "../types";

type TeamTabProps = {
  teamMembers: TeamMember[];
  membersLoading?: boolean;
};

export function TeamTab({ teamMembers, membersLoading }: TeamTabProps) {
  if (membersLoading) {
    return (
      <div className="settingsPage__loadingWrap">
        <div className="settingsPage__spinner" aria-label="Loading team members" />
      </div>
    );
  }

  return (
    <div className="settingsPage__table">
      <div className="settingsPage__tableHeader">
        <span>Member</span>
        <span>Email</span>
        <span>Role</span>
        <span>Status</span>
        <span />
      </div>
      {teamMembers.map((member) => (
        <div key={member.id} className="settingsPage__tableRow">
          <div className="settingsPage__memberInfo">
            <div
              className={`settingsPage__memberAvatar settingsPage__memberAvatar--${member.roleTone}`}
            >
              {member.initials}
            </div>
            <span className="settingsPage__memberName">
              {member.name}
            </span>
          </div>
          <span className="settingsPage__memberEmail">
            {member.email}
          </span>
          <span
            className={`settingsPage__pill settingsPage__pill--${member.roleTone}`}
          >
            {member.role}
          </span>
          <span
            className={`settingsPage__status settingsPage__status--${
              member.status === "Active" ? "active" : "pending"
            }`}
          >
            <span className="settingsPage__statusDot" aria-hidden />
            {member.status}
          </span>
          <div className="settingsPage__rowActions">
            <button
              type="button"
              className="settingsPage__iconBtn"
              aria-label="Edit member"
            >
              <span
                className="settingsPage__icon"
                data-icon="pencil"
                aria-hidden
              />
            </button>
            <button
              type="button"
              className="settingsPage__iconBtn"
              aria-label="More actions"
            >
              <span
                className="settingsPage__icon"
                data-icon="ellipsis"
                aria-hidden
              />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
