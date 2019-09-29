'use strict';

const kpxcUsernameFields = {};
kpxcUsernameFields.icons = [];

kpxcUsernameFields.newIcon = function(field, databaseClosed = true) {
    kpxcUsernameFields.icons.push(new UsernameFieldIcon(field, databaseClosed));
};

kpxcUsernameFields.switchIcon = function(locked) {
    kpxcUsernameFields.icons.forEach(u => u.switchIcon(locked));
};


class UsernameFieldIcon extends Icon {
    constructor(field, databaseClosed = true) {
        super();
        this.icon = null;
        this.inputField = null;

        this.initField(field, databaseClosed);
        kpxcUI.monitorIconPosition(this);
    }

    switchIcon(locked) {
        if (!this.icon) {
            return;
        }
    
        if (locked) {
            this.icon.classList.remove(getIconClassName());
            this.icon.classList.add(getIconClassName(true));
            this.icon.title = tr('usernameLockedFieldText');
        } else {
            this.icon.classList.remove(getIconClassName(true));
            this.icon.classList.add(getIconClassName());
            this.icon.title = tr('usernameFieldText');
        }
    }
};

UsernameFieldIcon.prototype.initField = function(field, databaseClosed = true) {
    if (!field || field.getAttribute('kpxc-username-field') === 'true') {
        return;
    }

    field.setAttribute('kpxc-username-field', 'true');

    // Observer the visibility
    if (this.observer) {
        this.observer.observe(field);
    }

    this.createIcon(field, databaseClosed);
    this.inputField = field;
};

UsernameFieldIcon.prototype.createIcon = function(target, databaseClosed) {
    // Remove any existing password generator icons from the input field
    if (target.getAttribute('kpxc-password-generator')) {
        kpxcPasswordDialog.removeIcon(target);
    }

    const field = target;
    const className = getIconClassName(databaseClosed);

    // Size the icon dynamically, but not greater than 24 or smaller than 14
    const size = Math.max(Math.min(24, field.offsetHeight - 4), 14);
    
    // Don't create the icon if the input field is too small
    if (field.offsetWidth < (size * 1.5) || field.offsetHeight < size) {
        this.observer.unobserve(field);
        return;
    }

    let offset = Math.floor((field.offsetHeight - size) / 3);
    offset = (offset < 0) ? 0 : offset;

    const icon = kpxcUI.createElement('div', 'kpxc kpxc-username-icon ' + className,
        {
            'title': databaseClosed ? tr('usernameLockedFieldText') : tr('usernameFieldText'),
            'alt': tr('usernameFieldIcon'),
            'size': size,
            'offset': offset,
            'kpxc-pwgen-field-id': field.getAttribute('data-kpxc-id')
        });
    icon.style.zIndex = '10000000';
    icon.style.width = Pixels(size);
    icon.style.height = Pixels(size);

    icon.addEventListener('click', function(e) {
        if (!e.isTrusted) {
            return;
        }

        e.preventDefault();
        iconClicked(field, icon);
    });

    kpxcUI.setIconPosition(icon, field);
    this.icon = icon;
    document.body.appendChild(icon);
};

const iconClicked = async function(field, icon) {
    if (!kpxcFields.isVisible(field)) {
        document.body.removeChild(icon);
        field.removeAttribute('kpxc-username-field');
        return;
    }

    const connected = await browser.runtime.sendMessage({ action: 'is_connected' });
    if (!connected) {
        kpxcUI.createNotification('error', tr('errorNotConnected'));
        return;
    }

    const databaseHash = await browser.runtime.sendMessage({ action: 'check_database_hash' });
    if (databaseHash === '') {
        // Triggers database unlock
        _called.manualFillRequested = ManualFill.BOTH;
        await browser.runtime.sendMessage({
            action: 'get_database_hash',
            args: [ false, true ] // Set triggerUnlock to true
        });
    }

    if (icon.className.includes('unlock')) {
        fillCredentials(field);
    }
};

const getIconClassName = function(locked = false) {
    if (locked) {
        return (isFirefox() ? 'lock-moz' : 'lock');
    }
    return (isFirefox() ? 'unlock-moz' : 'unlock');
};

const fillCredentials = function(field) {
    const fieldId = field.getAttribute('data-kpxc-id');
    kpxcFields.prepareId(fieldId);

    const givenType = field.type === 'password' ? 'password' : 'username';
    const combination = kpxcFields.getCombination(givenType, fieldId);

    kpxc.fillInCredentials(combination, givenType === 'password', false);
};
