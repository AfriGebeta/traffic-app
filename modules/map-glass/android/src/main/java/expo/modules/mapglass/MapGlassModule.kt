package expo.modules.mapglass

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MapGlassModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MapGlass")

    // Do not register hardware rendering views on unsupported Android versions.
    if (Build.VERSION.SDK_INT >= 31) {
      View(MapGlassTarget::class) {
        Name("Target")
        Prop("targetId") { view: MapGlassTarget, id: String -> view.targetId = id }
      }

      View(MapGlassBlur::class) {
        Name("Blur")
        Prop("targetId") { view: MapGlassBlur, id: String -> view.targetId = id }
        Prop("radius") { view: MapGlassBlur, radius: Float -> view.radius = radius }
      }
    }
  }
}
