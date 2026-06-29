export type LivenessChallenge = 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | 'NOD';

export interface LivenessStatus {
  passed: boolean;
  progress: number; // 0 to 100
  instruction: string;
}

/**
 * Evaluates facial landmarks to check if the student passed the active challenge.
 * Uses keypoint index coordinates from TensorFlow MediaPipe FaceMesh model.
 */
export function checkChallenge(
  keypoints: any[],
  challenge: LivenessChallenge
): LivenessStatus {
  if (!keypoints || keypoints.length === 0) {
    return { passed: false, progress: 0, instruction: 'Position your face in the camera frame' };
  }

  // Helper: Calculate Euclidean distance in 3D
  const distance = (p1: any, p2: any) => {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2) +
      Math.pow(p1.z - p2.z, 2)
    );
  };

  switch (challenge) {
    case 'BLINK': {
      // Landmark Indexes: Left Eye (33, 133), Right Eye (362, 263)
      // Top/Bottom Eyelids: Left (159, 145), Right (386, 374)
      const leftEyeDist = distance(keypoints[159], keypoints[145]);
      const rightEyeDist = distance(keypoints[386], keypoints[374]);
      
      const leftEyeWidth = distance(keypoints[33], keypoints[133]);
      const rightEyeWidth = distance(keypoints[362], keypoints[263]);

      // Eye Aspect Ratio (EAR)
      const leftEAR = leftEyeDist / leftEyeWidth;
      const rightEAR = rightEyeDist / rightEyeWidth;
      const averageEAR = (leftEAR + rightEAR) / 2;

      // Lower EAR indicates closed eyes (blink)
      const isBlinking = averageEAR < 0.18;
      return {
        passed: isBlinking,
        progress: isBlinking ? 100 : 20,
        instruction: 'Blink your eyes once clearly'
      };
    }

    case 'TURN_LEFT': {
      // Compares horizontal nose tip relative to ears/sides of face
      // Nose Tip: 1, Left side profile: 234, Right side profile: 454
      // Use 2D X-coordinates for robust turn detection
      const leftDist = Math.abs(keypoints[1].x - keypoints[234].x);
      const rightDist = Math.abs(keypoints[1].x - keypoints[454].x);
      
      // When turning left (user's left), nose moves toward the left cheek, making leftDist smaller
      // and rightDist larger.
      const ratio = rightDist / (leftDist || 1); // Avoid division by zero
      const passed = ratio > 2.0;
      return {
        passed,
        progress: Math.min(100, Math.max(0, Math.floor((ratio - 1.0) * 100))),
        instruction: 'Slowly turn your head to the left'
      };
    }

    case 'TURN_RIGHT': {
      const leftDist = Math.abs(keypoints[1].x - keypoints[234].x);
      const rightDist = Math.abs(keypoints[1].x - keypoints[454].x);
      
      // When turning right (user's right), nose moves toward the right cheek, making rightDist smaller
      // and leftDist larger.
      const ratio = leftDist / (rightDist || 1);
      const passed = ratio > 2.0;
      return {
        passed,
        progress: Math.min(100, Math.max(0, Math.floor((ratio - 1.0) * 100))),
        instruction: 'Slowly turn your head to the right'
      };
    }

    case 'NOD': {
      // Nose Tip: 1, Forehead: 10, Chin: 152
      const noseToForehead = distance(keypoints[1], keypoints[10]);
      const noseToChin = distance(keypoints[1], keypoints[152]);
      
      const ratio = noseToChin / noseToForehead;
      // Noddings tilt ratio triggers
      const passed = ratio < 0.75 || ratio > 1.6;
      return {
        passed,
        progress: passed ? 100 : 50,
        instruction: 'Nod your head up and down'
      };
    }

    default:
      return { passed: false, progress: 0, instruction: 'Keep looking straight' };
  }
}
