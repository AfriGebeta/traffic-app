package expo.modules.mapglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.RenderNode
import android.os.Build
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.lang.ref.WeakReference

/** captures only the map's display list, never the glass or its foreground content. */
class MapGlassTarget(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  companion object {
    private val targets = mutableMapOf<String, WeakReference<MapGlassTarget>>()
    fun find(id: String): MapGlassTarget? = targets[id]?.get()
  }

  internal val mapNode = if (Build.VERSION.SDK_INT >= 31) RenderNode("Map glass source") else null

  var targetId: String = ""
    set(value) {
      unregister()
      field = value
      if (isAttachedToWindow) register()
    }

  private fun register() {
    if (targetId.isNotEmpty()) targets[targetId] = WeakReference(this)
  }

  private fun unregister() {
    if (targets[targetId]?.get() === this) targets.remove(targetId)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    register()
  }

  override fun onDetachedFromWindow() {
    unregister()
    if (Build.VERSION.SDK_INT >= 31) mapNode?.discardDisplayList()
    super.onDetachedFromWindow()
  }

  override fun dispatchDraw(canvas: Canvas) {
    val node = mapNode
    if (Build.VERSION.SDK_INT < 31 || !canvas.isHardwareAccelerated || node == null || width == 0 || height == 0) {
      super.dispatchDraw(canvas)
      return
    }
    node.setPosition(0, 0, width, height)
    val recording = node.beginRecording()
    try {
      super.dispatchDraw(recording)
    } finally {
      node.endRecording()
    }
    canvas.drawRenderNode(node)
  }
}
