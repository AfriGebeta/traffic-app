package expo.modules.mapglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.Shader
import android.os.Build
import android.view.ViewTreeObserver
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.ceil

/** gpu blur of a shared map display list, cropped to this control's window position. */
class MapGlassBlur(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val blurNode = if (Build.VERSION.SDK_INT >= 31) RenderNode("Map glass blur") else null
  private val sourcePosition = IntArray(2)
  private val glassPosition = IntArray(2)
  private var drawnOffsetX = Int.MIN_VALUE
  private var drawnOffsetY = Int.MIN_VALUE

  var targetId: String = ""
    set(value) {
      if (isAttachedToWindow) MapGlassTarget.removeBlur(field, this)
      field = value
      if (isAttachedToWindow) MapGlassTarget.addBlur(value, this)
      invalidate()
    }

  var radius: Float = 10f
    set(value) {
      field = value.coerceIn(1f, 24f)
      updateEffect()
      invalidate()
    }


  // Map frames are pushed by MapGlassTarget; this only catches the glass itself moving
  // (sheet/translate animations) while the map is idle. It runs only when a frame is drawn anyway.
  private val preDraw = ViewTreeObserver.OnPreDrawListener {
    val target = MapGlassTarget.find(targetId)
    if (target != null) {
      target.getLocationInWindow(sourcePosition)
      getLocationInWindow(glassPosition)
      val offsetX = sourcePosition[0] - glassPosition[0]
      val offsetY = sourcePosition[1] - glassPosition[1]
      if (offsetX != drawnOffsetX || offsetY != drawnOffsetY) {
        // Record now so an early-returning onDraw can't turn this into a per-frame loop.
        drawnOffsetX = offsetX
        drawnOffsetY = offsetY
        invalidate()
      }
    }
    true
  }

  init {
    setWillNotDraw(false)
    updateEffect()
  }

  private fun updateEffect() {
    if (Build.VERSION.SDK_INT >= 31) {
      val pixels = radius * resources.displayMetrics.density
      blurNode?.setRenderEffect(RenderEffect.createBlurEffect(pixels, pixels, Shader.TileMode.CLAMP))
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    MapGlassTarget.addBlur(targetId, this)
    viewTreeObserver.addOnPreDrawListener(preDraw)
  }

  override fun onDetachedFromWindow() {
    MapGlassTarget.removeBlur(targetId, this)
    viewTreeObserver.removeOnPreDrawListener(preDraw)
    drawnOffsetX = Int.MIN_VALUE
    drawnOffsetY = Int.MIN_VALUE
    if (Build.VERSION.SDK_INT >= 31) blurNode?.discardDisplayList()
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (Build.VERSION.SDK_INT < 31 || !canvas.isHardwareAccelerated) return
    val target = MapGlassTarget.find(targetId) ?: return
    val source = target.mapNode ?: return
    val node = blurNode ?: return
    if (!target.isShown || !source.hasDisplayList() || width == 0 || height == 0) return

    target.getLocationInWindow(sourcePosition)
    getLocationInWindow(glassPosition)
    drawnOffsetX = sourcePosition[0] - glassPosition[0]
    drawnOffsetY = sourcePosition[1] - glassPosition[1]
    // Include surrounding map pixels so blur doesn't produce dark seams at the rim.
    val padding = ceil(radius * resources.displayMetrics.density * 3).toInt()
    node.setPosition(-padding, -padding, width + padding, height + padding)
    val recording = node.beginRecording()
    try {
      recording.translate(
        (sourcePosition[0] - glassPosition[0] + padding).toFloat(),
        (sourcePosition[1] - glassPosition[1] + padding).toFloat()
      )
      recording.drawRenderNode(source)
    } finally {
      node.endRecording()
    }
    canvas.drawRenderNode(node)
  }
}
