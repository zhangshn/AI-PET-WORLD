import unittest

import numpy as np

from ai_painter.dataset.component_instances import connected_components, padded_square


class ComponentInstanceTests(unittest.TestCase):
    def test_disconnected_regions_become_separate_instances(self):
        mask = np.zeros((32, 32), dtype=np.uint8)
        mask[2:6, 3:8] = 255
        mask[20:27, 22:29] = 255
        components = connected_components(mask, minimum_pixels=4)
        self.assertEqual(len(components), 2)
        self.assertEqual(components[0].pixels, 49)
        self.assertEqual(components[1].pixels, 20)

    def test_small_noise_is_removed_and_crop_stays_inside_canvas(self):
        mask = np.zeros((24, 40), dtype=np.uint8)
        mask[0, 0] = 255
        mask[18:24, 34:40] = 255
        components = connected_components(mask, minimum_pixels=4)
        self.assertEqual(len(components), 1)
        x, y, size = padded_square(components[0], 40, 24)
        self.assertGreaterEqual(x, 0)
        self.assertGreaterEqual(y, 0)
        self.assertLessEqual(x + size, 40)
        self.assertLessEqual(y + size, 24)


if __name__ == "__main__":
    unittest.main()
