package expo.modules.mapglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.RenderEffect
import android.graphics.RenderNode
import android.graphics.Shader
import android.os.Build
import android.view.View
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.ceil

/** gpu blur of a shared map display list, cropped to this control's window position. */
class MapGlassBlur(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val blurNode = if (Build.VERSION.SDK_INT >= 31) RenderNode("Map glass blur") else null
  private val sourcePosition = IntArray(2)
  private val glassPosition = IntArray(2)
  private var refreshing = false

  var targetId: String = ""
    set(value) { field = value; invalidate() }

  var radius: Float = 10f
    set(value) {
      field = value.coerceIn(1f, 24f)
      updateEffect()
      invalidate()
    }


  private val refresh = object : Runnable {
    override fun run() {
      if (!refreshing) return
      invalidate()
      postDelayed(this, 33L)
    }
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

  private fun updateRefresh() {
    val shouldRefresh = Build.VERSION.SDK_INT >= 31 && isAttachedToWindow && isShown && windowVisibility == View.VISIBLE && hasWindowFocus()
    if (shouldRefresh == refreshing) return
    refreshing = shouldRefresh
    removeCallbacks(refresh)
    if (refreshing) post(refresh)
  }

  override fun onAttachedToWindow() { super.onAttachedToWindow(); updateRefresh() }
  override fun onWindowFocusChanged(hasWindowFocus: Boolean) { super.onWindowFocusChanged(hasWindowFocus); updateRefresh() }
  override fun onWindowVisibilityChanged(visibility: Int) { super.onWindowVisibilityChanged(visibility); updateRefresh() }
  override fun onVisibilityChanged(changedView: View, visibility: Int) {
    super.onVisibilityChanged(changedView, visibility)
    // Android may invoke this during superclass construction.
    if (isAttachedToWindow) updateRefresh()
  }

  override fun onDetachedFromWindow() {
    refreshing = false
    removeCallbacks(refresh)
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
