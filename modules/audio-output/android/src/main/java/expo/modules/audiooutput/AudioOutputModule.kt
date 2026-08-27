package expo.modules.audiooutput

import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AudioOutputModule : Module() {
  private var audioDeviceCallback: AudioDeviceCallback? = null

  override fun definition() = ModuleDefinition {
    Name("AudioOutput")

    Events("onAudioOutputChanged")

    OnCreate {
      setupDeviceCallback()
    }

    OnDestroy {
      removeDeviceCallback()
    }

    AsyncFunction("getCurrentOutputDevice") {
      getCurrentAudioDeviceInfo()
    }
  }

  private fun getAudioManager(): AudioManager? {
    val context = appContext.reactContext ?: return null
    return context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
  }

  private fun setupDeviceCallback() {
    val audioManager = getAudioManager() ?: return
    if (audioDeviceCallback != null) return

    val callback = object : AudioDeviceCallback() {
      override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) {
        sendEvent("onAudioOutputChanged", getCurrentAudioDeviceInfo())
      }

      override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) {
        sendEvent("onAudioOutputChanged", getCurrentAudioDeviceInfo())
      }
    }

    audioDeviceCallback = callback
    audioManager.registerAudioDeviceCallback(callback, Handler(Looper.getMainLooper()))
  }

  private fun removeDeviceCallback() {
    val callback = audioDeviceCallback ?: return
    val audioManager = getAudioManager() ?: return
    audioManager.unregisterAudioDeviceCallback(callback)
    audioDeviceCallback = null
  }

  private fun getCurrentAudioDeviceInfo(): Map<String, Any?> {
    val audioManager = getAudioManager()
    if (audioManager == null) {
      return mapOf(
        "name" to "speaker",
        "type" to "speaker",
        "isHeadphones" to false
      )
    }

    val outputDevices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)

    val priorityDevice = outputDevices.firstOrNull { it.isBluetooth() }
      ?: outputDevices.firstOrNull { it.isWiredHeadset() }
      ?: outputDevices.firstOrNull { it.isUsbAudio() }
      ?: outputDevices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
      ?: outputDevices.firstOrNull()

    if (priorityDevice == null) {
      return mapOf(
        "name" to "speaker",
        "type" to "speaker",
        "isHeadphones" to false
      )
    }

    val name = priorityDevice.productName.toString().takeIf { it.isNotBlank() }
      ?: getDeviceTypeName(priorityDevice.type)

    val isHeadphones = priorityDevice.isBluetooth() || priorityDevice.isWiredHeadset() || priorityDevice.isUsbAudio()

    return mapOf(
      "name" to name,
      "type" to getDeviceTypeName(priorityDevice.type),
      "isHeadphones" to isHeadphones
    )
  }

  private fun AudioDeviceInfo.isBluetooth(): Boolean {
    return type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
      type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
      (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && (type == AudioDeviceInfo.TYPE_BLE_HEADSET || type == AudioDeviceInfo.TYPE_BLE_SPEAKER))
  }

  private fun AudioDeviceInfo.isWiredHeadset(): Boolean {
    return type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || type == AudioDeviceInfo.TYPE_WIRED_HEADSET
  }

  private fun AudioDeviceInfo.isUsbAudio(): Boolean {
    return type == AudioDeviceInfo.TYPE_USB_DEVICE || type == AudioDeviceInfo.TYPE_USB_HEADSET
  }

  private fun getDeviceTypeName(type: Int): String {
    return when (type) {
      AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "earpiece"
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
      AudioDeviceInfo.TYPE_WIRED_HEADSET -> "wired_headset"
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "wired_headphones"
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "bluetooth"
      AudioDeviceInfo.TYPE_USB_DEVICE,
      AudioDeviceInfo.TYPE_USB_HEADSET -> "usb_audio"
      else -> {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && (type == AudioDeviceInfo.TYPE_BLE_HEADSET || type == AudioDeviceInfo.TYPE_BLE_SPEAKER)) {
          "bluetooth"
        } else {
          "unknown"
        }
      }
    }
  }
}
