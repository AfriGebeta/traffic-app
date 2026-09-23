package expo.modules.mapglass

import android.content.Context
import android.graphics.Canvas
import android.graphics.RenderNode
import android.graphics.SurfaceTexture
import android.os.Build
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.lang.ref.WeakReference

/** captures only the map's display list, never the glass or its foreground content. */
class MapGlassTarget(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  companion object {
    private val targets = mutableMapOf<String, WeakReference<MapGlassTarget>>()
    private val blurs = mutableMapOf<String, MutableSet<MapGlassBlur>>()

    fun find(id: String): MapGlassTarget? = targets[id]?.get()

    fun addBlur(id: String, blur: MapGlassBlur) {
      blurs.getOrPut(id) { mutableSetOf() }.add(blur)
    }

    fun removeBlur(id: String, blur: MapGlassBlur) {
      val set = blurs[id] ?: return
      set.remove(blur)
      if (set.isEmpty()) blurs.remove(id)
    }

    fun notifyBlurs(id: String) {
      blurs[id]?.forEach { it.invalidate() }
    }
  }

  internal val mapNode = if (Build.VERSION.SDK_INT >= 31) RenderNode("Map glass source") else null

  // The map renders into a TextureView on its own GL thread; new frames update the texture layer
  // without redrawing ancestors, so the blurs are told explicitly instead of polling on a timer.
  private var textureView: TextureView? = null

  private inner class FrameListener(val delegate: TextureView.SurfaceTextureListener?) : TextureView.SurfaceTextureListener {
    val owner: MapGlassTarget get() = this@MapGlassTarget

    override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
      delegate?.onSurfaceTextureAvailable(surface, width, height)
      notifyBlurs(targetId)
    }

    override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {
      delegate?.onSurfaceTextureSizeChanged(surface, width, height)
      notifyBlurs(targetId)
    }

    override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean =
      delegate?.onSurfaceTextureDestroyed(surface) ?: true

    override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {
      delegate?.onSurfaceTextureUpdated(surface)
      notifyBlurs(targetId)
    }
  }

  var targetId: String = ""
    set(value) {
      unregister()
      field = value
      if (isAttachedToWindow) register()
    }

  private fun register() {
    if (targetId.isEmpty()) return
    targets[targetId] = WeakReference(this)
    notifyBlurs(targetId)
  }

  private fun unregister() {
    if (targets[targetId]?.get() === this) targets.remove(targetId)
  }

  private fun findTextureView(view: View): TextureView? {
    if (view is TextureView) return view
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        findTextureView(view.getChildAt(i))?.let { return it }
      }
    }
    return null
  }

  private fun hookTextureView() {
    val current = textureView?.takeIf { it.isAttachedToWindow && it.parent != null }
      ?: findTextureView(this)
      ?: return
    textureView = current
    // Re-wrap if the map installed a new listener since the last draw.
    val listener = current.surfaceTextureListener
    if (listener is FrameListener && listener.owner === this) return
    // Unwrap a listener left behind by a previous target so wrappers never chain.
    current.surfaceTextureListener = FrameListener(if (listener is FrameListener) listener.delegate else listener)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    register()
  }

  override fun onDetachedFromWindow() {
    unregister()
    textureView = null
    if (Build.VERSION.SDK_INT >= 31) mapNode?.discardDisplayList()
    super.onDetachedFromWindow()
  }

  override fun dispatchDraw(canvas: Canvas) {
    val node = mapNode
    if (Build.VERSION.SDK_INT < 31 || !canvas.isHardwareAccelerated || node == null || width == 0 || height == 0) {
      super.dispatchDraw(canvas)
      return
    }
    hookTextureView()
    node.setPosition(0, 0, width, height)
    val recording = node.beginRecording()
    try {
      super.dispatchDraw(recording)
    } finally {
      node.endRecording()
    }
    canvas.drawRenderNode(node)
    notifyBlurs(targetId)
  }
}
