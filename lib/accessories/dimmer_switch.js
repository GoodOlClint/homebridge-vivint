const Device = require('../device.js')
const VivintDict = require("../vivint_dictionary.json")
const debounce = require("debounce-promise")

class DimmerSwitch extends Device {
    constructor(accessory, data, config, log, homebridge, vivintApi) {
        super(accessory, data, config, log, homebridge, vivintApi)

      let self = this
      let promiseSetter = function(fn) {
        let boundDebounced = debounce(fn.bind(self), 500, {
          leading: true
        })
        return (value, next) => {
          boundDebounced(value, next)
        }
      }

      this.service = accessory.getService(this.Service.Lightbulb) || accessory.getService(this.Service.Fan)

      this.service
        .getCharacteristic(this.Characteristic.On)
        .on('get', (next) => next(null, this.switchCurrentValue()))
        .on('set', this.setSwitchCurrentValue.bind(this))

      if (accessory.context.name.match(/\bfan\b/i)) {
        this.is_fan = true
        this.service
          .getCharacteristic(this.Characteristic.RotationSpeed)
          .on('get', (next) => next(null, this.switchBrightnessValue()))
          .on('set', promiseSetter(this.setBrightnessValue.bind(this)))
       } else {
        this.is_fan = false
        this.service
          .getCharacteristic(this.Characteristic.Brightness)
          .on('get', (next) => next(null, this.switchBrightnessValue()))
          .on('set', promiseSetter(this.setBrightnessValue.bind(this)))
      }

      this.last_val_s = null
      this.last_val = null
    }

    switchCurrentValue() {
      return this.data.Status
    }

    setSwitchCurrentValue(targetState, next) {
      if (targetState) {
        // turn switch on
        this.vivintApi.putDevice('switches', this.id, {
            s: true,
            _id: this.id
          })
          .then(
            (success) => next(),
            (failure) => {
              this.log.error("Failure setting dimmer switch state:", failure)
              next(failure)
            })
      } else {
        // turn switch off
        this.vivintApi.putDevice('switches', this.id, {
            s: false,
            _id: this.id
          })
          .then(
            (success) => next(),
            (failure) => {
              this.log.error("Failure setting dimmer switch state:", failure)
              next(failure)
            })
      }
    }

    switchBrightnessValue() {
      return this.data.Value
    }

    setBrightnessValue(targetState, next) {
      this.vivintApi.putDevice('switches', this.id, {
          val: targetState,
          _id: this.id
        })
        .then(
          (success) => next(),
          (failure) => {
            this.log.error("Failure setting dimmer brightness state:", failure)
            next(failure)
          })
    }

    notify() {
      // vivint will typically send two notifications

      if (this.service) {
        if (this.data.Value !== this.last_val) {
          // dimmer level has changed, update HomeKit
          this.last_val = this.data.Value
          if (this.is_fan) {
            this.service
              .getCharacteristic(this.Characteristic.RotationSpeed)
              .updateValue(this.data.Value)
          } else {
            this.service
              .getCharacteristic(this.Characteristic.Brightness)
              .updateValue(this.data.Value)
          }
        }

        if (this.data.Status !== this.last_val_s) {
          // on/off state has changed, update HomeKit
          this.last_val_s = this.data.Status
          this.service
            .getCharacteristic(this.Characteristic.On)
            .updateValue(this.switchCurrentValue())
        }
      }
    }

    static appliesTo(data) {
      return data.Type == VivintDict.PanelDeviceType.MultiLevelSwitch
    }

    static inferCategory(data, Accessory) {
      return Accessory.Categories.SWITCH
    }

    static addServices(accessory, Service) {
      if (accessory.context.name.match(/\bfan\b/i)) {
        accessory.addService(new Service.Fan(accessory.context.name))
      } else {
        accessory.addService(new Service.Lightbulb(accessory.context.name))
      }
    }
  }

module.exports = DimmerSwitch
