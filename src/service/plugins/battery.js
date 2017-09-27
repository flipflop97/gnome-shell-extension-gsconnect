"use strict";

// Imports
const Lang = imports.lang;
const Gettext = imports.gettext.domain("org.gnome.shell.extensions.gsconnect");
const _ = Gettext.gettext;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Notify = imports.gi.Notify;

// Local Imports
function getPath() {
    // Diced from: https://github.com/optimisme/gjs-examples/
    let m = new RegExp("@(.+):\\d+").exec((new Error()).stack.split("\n")[1]);
    let p = Gio.File.new_for_path(m[1]).get_parent().get_parent().get_parent();
    return p.get_path();
}

imports.searchPath.push(getPath());

const { initTranslations, Me, DBusInfo, Settings } = imports.common;
const Config = imports.service.config;
const Protocol = imports.service.protocol;
const PluginsBase = imports.service.plugins.base;


var METADATA = {
    name: "battery",
    incomingPackets: ["kdeconnect.battery"],
    outgoingPackets: ["kdeconnect.battery.request"],
    settings: {
        threshold_notification: true,
        threshold_level: -2
    }
};


/**
 * Battery Plugin
 * https://github.com/KDE/kdeconnect-kde/tree/master/plugins/battery
 */
var Plugin = new Lang.Class({
    Name: "GSConnectBatteryPlugin",
    Extends: PluginsBase.Plugin,
    Properties: {
        "charging": GObject.ParamSpec.boolean(
            "charging",
            "isCharging",
            "Whether the device is charging",
            GObject.ParamFlags.READABLE,
            false
        ),
        "level": GObject.ParamSpec.int(
            "level",
            "isCharging",
            "Whether the device is charging",
            GObject.ParamFlags.READABLE,
            -1
        ),
        "threshold": GObject.ParamSpec.int(
            "threshold",
            "isCharging",
            "Whether the battery has reached the warning level",
            GObject.ParamFlags.READABLE,
            -1
        )
    },
    
    _init: function (device) {
        this.parent(device, "battery");
        
        this._charging = false;
        this._level = -1;
        this._threshold = 0;
    },
    
    get charging() { return this._charging; },
    get level() { return this._level; },
    get threshold() { return this._threshold; },
    
    handlePacket: function (packet) {
        this._charging = packet.body.isCharging;
        this.notify("charging");
        this._dbus.emit_property_changed(
            "charging",
            new GLib.Variant("b", packet.body.isCharging)
        );
        
        this._level = packet.body.currentCharge;
        this.notify("level");
        this._dbus.emit_property_changed(
            "level",
            new GLib.Variant("i", packet.body.currentCharge)
        );
        
        // FIXME: settings
        //        note clearing...
        this._threshold = packet.body.thresholdEvent;
        this._dbus.emit_property_changed(
            "threshold",
            new GLib.Variant("i", packet.body.thresholdEvent)
        );
        
        if (this.settings.threshold_notification) {
            let note = new Notify.Notification({
                app_name: "GSConnect",
                id: packet.id / 1000,
                summary: _("%s - Low Battery Warning").format(this.device.name),
                body: _("Battery level is %d").format(this.level), // FIXME % in format strings
                icon_name: "phone-symbolic"
            });
        } else if (this.level <= this.settings.threshold_level) {
        }
    },
    
    /**
     * Request an update
     * TODO: test/check this works
     */
    update: function () {
        if (this.device.connected && this.device.paired) {
            let packet = new Protocol.Packet();
            packet.type = "kdeconnect.battery.request";
            packet.body = { request: true };
            
            this.device._channel.send(packet);
        }
    }
});
