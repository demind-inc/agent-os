"use client";

export function BillingTab() {
  return (
    <>
      <div className="settingsPage__card settingsPage__planCard">
        <div className="settingsPage__planInfo">
          <div className="settingsPage__planHeader">
            <span className="settingsPage__planName">Pro Plan</span>
            <span className="settingsPage__pill settingsPage__pill--green">
              Active
            </span>
          </div>
          <span className="settingsPage__planDesc">
            $29/month • Billed monthly • Renews on Mar 15, 2026
          </span>
        </div>
        <div className="settingsPage__planActions">
          <button
            type="button"
            className="settingsPage__btn settingsPage__btn--accent settingsPage__btn--sm"
          >
            Upgrade Plan
          </button>
          <button
            type="button"
            className="settingsPage__btn settingsPage__btn--secondary settingsPage__btn--sm"
          >
            Manage
          </button>
        </div>
      </div>
      <div className="settingsPage__billingGrid">
        <div className="settingsPage__card">
          <div className="settingsPage__cardHeader">
            <h3 className="settingsPage__cardTitle">Payment Method</h3>
            <button
              type="button"
              className="settingsPage__btn settingsPage__btn--secondary settingsPage__btn--xs"
            >
              <span
                className="settingsPage__icon"
                data-icon="plus"
                aria-hidden
              />
              Add
            </button>
          </div>
          <div className="settingsPage__paymentMethod">
            <div className="settingsPage__paymentIcon">VISA</div>
            <div className="settingsPage__paymentInfo">
              <span className="settingsPage__paymentNumber">
                •••• •••• •••• 4242
              </span>
              <span className="settingsPage__paymentExpiry">
                Expires 12/2027
              </span>
            </div>
            <span className="settingsPage__pill settingsPage__pill--purple">
              Default
            </span>
          </div>
        </div>
        <div className="settingsPage__card">
          <h3 className="settingsPage__cardTitle">Current Usage</h3>
          <div className="settingsPage__usageItem">
            <div className="settingsPage__usageHeader">
              <span>AI Agent Tasks</span>
              <span>847 / 1,000</span>
            </div>
            <div className="settingsPage__usageBar">
              <span
                className="settingsPage__usageFill"
                style={{ width: "85%" }}
              />
            </div>
          </div>
          <div className="settingsPage__usageItem">
            <div className="settingsPage__usageHeader">
              <span>Team Members</span>
              <span>4 / 10</span>
            </div>
            <div className="settingsPage__usageBar">
              <span
                className="settingsPage__usageFill settingsPage__usageFill--green"
                style={{ width: "40%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
