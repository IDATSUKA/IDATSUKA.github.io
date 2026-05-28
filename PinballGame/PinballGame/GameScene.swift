import SpriteKit
import GameplayKit

// MARK: - Physics Categories
struct PhysicsCategory {
    static let none:        UInt32 = 0
    static let ball:        UInt32 = 0b1
    static let wall:        UInt32 = 0b10
    static let flipper:     UInt32 = 0b100
    static let bumper:      UInt32 = 0b1000
    static let target:      UInt32 = 0b10000
    static let kicker:      UInt32 = 0b100000
    static let drain:       UInt32 = 0b1000000
    static let plunger:     UInt32 = 0b10000000
    static let spinner:     UInt32 = 0b100000000
    static let gate:        UInt32 = 0b1000000000
}

// MARK: - GameScene
class GameScene: SKScene, SKPhysicsContactDelegate {

    // MARK: - Properties
    var ball: SKShapeNode!
    var leftFlipper: SKSpriteNode!
    var rightFlipper: SKSpriteNode!
    var leftFlipperJoint: SKPhysicsJointPin!
    var rightFlipperJoint: SKPhysicsJointPin!

    var scoreLabel: SKLabelNode!
    var livesLabel: SKLabelNode!
    var multiplierLabel: SKLabelNode!
    var highScoreLabel: SKLabelNode!

    var score: Int = 0 {
        didSet {
            scoreLabel.text = "SCORE: \(score)"
            if score > highScore {
                highScore = score
                UserDefaults.standard.set(highScore, forKey: "HighScore")
                highScoreLabel.text = "BEST: \(highScore)"
            }
        }
    }
    var lives: Int = 3 {
        didSet {
            var hearts = ""
            for i in 0..<3 {
                hearts += i < lives ? "●" : "○"
            }
            livesLabel.text = hearts
        }
    }
    var multiplier: Int = 1 {
        didSet {
            multiplierLabel.text = multiplier > 1 ? "×\(multiplier)" : ""
        }
    }
    var highScore: Int = 0
    var isGameOver = false
    var isBallLaunched = false
    var plungerPower: CGFloat = 0
    var plungerBar: SKShapeNode!
    var plungerIndicator: SKShapeNode!
    var isChargingPlunger = false

    var bumpers: [SKShapeNode] = []
    var targets: [SKShapeNode] = []
    var spinners: [SKSpriteNode] = []
    var kickers: [SKShapeNode] = []
    var gates: [SKShapeNode] = []
    var lights: [SKShapeNode] = []
    var rollovers: [SKShapeNode] = []
    var rolloverstates: [Bool] = []

    var bumperHitCount = 0
    var targetHitCount = 0

    let W: CGFloat = 390
    let H: CGFloat = 844

    // MARK: - Setup
    override func didMove(to view: SKView) {
        highScore = UserDefaults.standard.integer(forKey: "HighScore")
        backgroundColor = SKColor(red: 0.05, green: 0.05, blue: 0.15, alpha: 1.0)

        physicsWorld.gravity = CGVector(dx: 0, dy: -9.8)
        physicsWorld.contactDelegate = self
        physicsWorld.speed = 1.0

        setupBackground()
        setupWalls()
        setupFlippers()
        setupBumpers()
        setupTargets()
        setupKickers()
        setupSpinners()
        setupGates()
        setupRollovers()
        setupLights()
        setupPlunger()
        setupUI()
        spawnBall()
        startLightAnimation()
    }

    // MARK: - Background
    func setupBackground() {
        let bg = SKSpriteNode(color: SKColor(red: 0.03, green: 0.03, blue: 0.12, alpha: 1.0),
                              size: CGSize(width: W, height: H))
        bg.position = CGPoint(x: W/2, y: H/2)
        bg.zPosition = -10
        addChild(bg)

        // Decorative grid lines
        for i in stride(from: 0, through: Int(W), by: 40) {
            let line = SKShapeNode(rect: CGRect(x: CGFloat(i), y: 0, width: 1, height: H))
            line.fillColor = SKColor(white: 1, alpha: 0.03)
            line.strokeColor = .clear
            line.zPosition = -9
            addChild(line)
        }

        // Center decoration
        let centerDeco = SKShapeNode(circleOfRadius: 60)
        centerDeco.position = CGPoint(x: W/2, y: H * 0.55)
        centerDeco.strokeColor = SKColor(red: 0.3, green: 0.1, blue: 0.6, alpha: 0.5)
        centerDeco.lineWidth = 2
        centerDeco.fillColor = .clear
        centerDeco.zPosition = -8
        addChild(centerDeco)

        let innerDeco = SKShapeNode(circleOfRadius: 35)
        innerDeco.position = CGPoint(x: W/2, y: H * 0.55)
        innerDeco.strokeColor = SKColor(red: 0.5, green: 0.2, blue: 0.9, alpha: 0.4)
        innerDeco.lineWidth = 1.5
        innerDeco.fillColor = .clear
        innerDeco.zPosition = -8
        addChild(innerDeco)
    }

    // MARK: - Walls
    func setupWalls() {
        let wallColor = SKColor(red: 0.2, green: 0.6, blue: 1.0, alpha: 1.0)

        // Left wall
        addWall(from: CGPoint(x: 20, y: 160), to: CGPoint(x: 20, y: H - 20),
                color: wallColor, name: "leftWall")

        // Right wall (with plunger lane gap)
        addWall(from: CGPoint(x: W - 20, y: 160), to: CGPoint(x: W - 20, y: H - 20),
                color: wallColor, name: "rightWall")

        // Top wall
        addWall(from: CGPoint(x: 20, y: H - 20), to: CGPoint(x: W - 20, y: H - 20),
                color: wallColor, name: "topWall")

        // Plunger lane divider
        addWall(from: CGPoint(x: W - 55, y: 160), to: CGPoint(x: W - 55, y: H * 0.7),
                color: wallColor, name: "laneWall")

        // Left diagonal (lower left)
        addWall(from: CGPoint(x: 20, y: 160), to: CGPoint(x: 100, y: 210),
                color: wallColor, name: "leftDiag")

        // Right diagonal (lower right)
        addWall(from: CGPoint(x: W - 55, y: 160), to: CGPoint(x: W - 130, y: 210),
                color: wallColor, name: "rightDiag")

        // Left upper diagonal (kicker guide)
        addWall(from: CGPoint(x: 20, y: H * 0.62), to: CGPoint(x: 85, y: H * 0.68),
                color: wallColor, name: "leftGuide")

        // Right upper diagonal (kicker guide)
        addWall(from: CGPoint(x: W - 55, y: H * 0.62), to: CGPoint(x: W - 115, y: H * 0.68),
                color: wallColor, name: "rightGuide")

        // Drain sensor
        let drainPath = CGMutablePath()
        drainPath.move(to: CGPoint(x: 100, y: 150))
        drainPath.addLine(to: CGPoint(x: W - 130, y: 150))
        let drain = SKShapeNode(path: drainPath)
        drain.strokeColor = SKColor(red: 1.0, green: 0.2, blue: 0.2, alpha: 0.8)
        drain.lineWidth = 3
        drain.name = "drain"
        let drainBody = SKPhysicsBody(edgeFrom: CGPoint(x: 100, y: 150),
                                      to: CGPoint(x: W - 130, y: 150))
        drainBody.categoryBitMask = PhysicsCategory.drain
        drainBody.contactTestBitMask = PhysicsCategory.ball
        drainBody.collisionBitMask = PhysicsCategory.none
        drain.physicsBody = drainBody
        addChild(drain)
    }

    func addWall(from start: CGPoint, to end: CGPoint, color: SKColor, name: String) {
        let wallPath = CGMutablePath()
        wallPath.move(to: start)
        wallPath.addLine(to: end)
        let wall = SKShapeNode(path: wallPath)
        wall.strokeColor = color
        wall.lineWidth = 4
        wall.glowWidth = 2
        wall.name = name
        let body = SKPhysicsBody(edgeFrom: start, to: end)
        body.categoryBitMask = PhysicsCategory.wall
        body.collisionBitMask = PhysicsCategory.ball
        body.friction = 0.1
        body.restitution = 0.6
        wall.physicsBody = body
        addChild(wall)
    }

    // MARK: - Flippers
    func setupFlippers() {
        // Left flipper
        leftFlipper = createFlipper(isLeft: true)
        leftFlipper.position = CGPoint(x: 125, y: 200)
        addChild(leftFlipper)

        let leftAnchor = CGPoint(x: 125, y: 200)
        let leftBody = SKPhysicsBody(edgeFrom: CGPoint(x: 0, y: 0),
                                      to: CGPoint(x: 80, y: 0))
        leftBody.isDynamic = false
        let leftAnchorNode = SKNode()
        leftAnchorNode.position = leftAnchor
        leftAnchorNode.physicsBody = leftBody
        addChild(leftAnchorNode)

        leftFlipperJoint = SKPhysicsJointPin.joint(
            withBodyA: leftFlipper.physicsBody!,
            bodyB: leftAnchorNode.physicsBody!,
            anchor: leftAnchor
        )
        leftFlipperJoint.shouldEnableLimits = true
        leftFlipperJoint.lowerAngleLimit = -CGFloat.pi / 6
        leftFlipperJoint.upperAngleLimit = CGFloat.pi / 4
        physicsWorld.add(leftFlipperJoint)

        // Right flipper
        rightFlipper = createFlipper(isLeft: false)
        rightFlipper.position = CGPoint(x: W - 125 - 80, y: 200)
        addChild(rightFlipper)

        let rightAnchor = CGPoint(x: W - 125, y: 200)
        let rightBody = SKPhysicsBody(edgeFrom: CGPoint(x: 0, y: 0),
                                       to: CGPoint(x: -80, y: 0))
        rightBody.isDynamic = false
        let rightAnchorNode = SKNode()
        rightAnchorNode.position = rightAnchor
        rightAnchorNode.physicsBody = rightBody
        addChild(rightAnchorNode)

        rightFlipperJoint = SKPhysicsJointPin.joint(
            withBodyA: rightFlipper.physicsBody!,
            bodyB: rightAnchorNode.physicsBody!,
            anchor: rightAnchor
        )
        rightFlipperJoint.shouldEnableLimits = true
        rightFlipperJoint.lowerAngleLimit = -CGFloat.pi / 4
        rightFlipperJoint.upperAngleLimit = CGFloat.pi / 6
        physicsWorld.add(rightFlipperJoint)
    }

    func createFlipper(isLeft: Bool) -> SKSpriteNode {
        let size = CGSize(width: 85, height: 14)
        let flipper = SKSpriteNode(color: .clear, size: size)

        // Draw flipper shape
        let shape = SKShapeNode()
        let path = CGMutablePath()
        if isLeft {
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: 80, y: 6))
            path.addLine(to: CGPoint(x: 80, y: -6))
            path.addLine(to: CGPoint(x: 0, y: -6))
            path.closeSubpath()
        } else {
            path.move(to: CGPoint(x: 85, y: 0))
            path.addLine(to: CGPoint(x: 0, y: 6))
            path.addLine(to: CGPoint(x: 0, y: -6))
            path.addLine(to: CGPoint(x: 85, y: -6))
            path.closeSubpath()
        }
        shape.path = path
        shape.fillColor = SKColor(red: 0.1, green: 0.7, blue: 1.0, alpha: 1.0)
        shape.strokeColor = SKColor(red: 0.3, green: 0.9, blue: 1.0, alpha: 1.0)
        shape.lineWidth = 2
        shape.glowWidth = 4
        flipper.addChild(shape)

        let body = SKPhysicsBody(rectangleOf: size, center: CGPoint(x: size.width/2 - 5, y: 0))
        body.isDynamic = true
        body.mass = 1.0
        body.friction = 0.1
        body.restitution = 0.4
        body.categoryBitMask = PhysicsCategory.flipper
        body.collisionBitMask = PhysicsCategory.ball
        body.contactTestBitMask = PhysicsCategory.ball
        flipper.physicsBody = body
        flipper.name = isLeft ? "leftFlipper" : "rightFlipper"
        return flipper
    }

    // MARK: - Bumpers
    func setupBumpers() {
        let bumperPositions: [(CGFloat, CGFloat)] = [
            (W * 0.28, H * 0.72),
            (W * 0.50, H * 0.78),
            (W * 0.72, H * 0.72),  // Adjusted to not overlap plunger lane
            (W * 0.35, H * 0.65),
            (W * 0.50, H * 0.60),
            (W * 0.65, H * 0.65),  // Adjusted
        ]
        let colors: [SKColor] = [
            SKColor(red: 1.0, green: 0.2, blue: 0.5, alpha: 1.0),
            SKColor(red: 0.2, green: 1.0, blue: 0.5, alpha: 1.0),
            SKColor(red: 0.5, green: 0.2, blue: 1.0, alpha: 1.0),
            SKColor(red: 1.0, green: 0.8, blue: 0.0, alpha: 1.0),
            SKColor(red: 0.0, green: 0.8, blue: 1.0, alpha: 1.0),
            SKColor(red: 1.0, green: 0.4, blue: 0.0, alpha: 1.0),
        ]

        for (i, pos) in bumperPositions.enumerated() {
            let bumper = createBumper(color: colors[i % colors.count], index: i)
            bumper.position = CGPoint(x: pos.0, y: pos.1)
            bumpers.append(bumper)
            addChild(bumper)
        }
    }

    func createBumper(color: SKColor, index: Int) -> SKShapeNode {
        let radius: CGFloat = 22
        let bumper = SKShapeNode(circleOfRadius: radius)
        bumper.fillColor = color.withAlphaComponent(0.3)
        bumper.strokeColor = color
        bumper.lineWidth = 3
        bumper.glowWidth = 6
        bumper.name = "bumper_\(index)"

        // Inner circle
        let inner = SKShapeNode(circleOfRadius: 12)
        inner.fillColor = color.withAlphaComponent(0.6)
        inner.strokeColor = color
        inner.lineWidth = 2
        inner.name = "bumperInner"
        bumper.addChild(inner)

        // Score label on bumper
        let label = SKLabelNode(text: "100")
        label.fontSize = 9
        label.fontName = "Helvetica-Bold"
        label.fontColor = .white
        label.verticalAlignmentMode = .center
        label.name = "bumperScore"
        bumper.addChild(label)

        let body = SKPhysicsBody(circleOfRadius: radius)
        body.isDynamic = false
        body.categoryBitMask = PhysicsCategory.bumper
        body.contactTestBitMask = PhysicsCategory.ball
        body.collisionBitMask = PhysicsCategory.ball
        body.restitution = 1.2
        body.friction = 0.0
        bumper.physicsBody = body

        return bumper
    }

    // MARK: - Targets
    func setupTargets() {
        // Drop targets (row of 5)
        let targetY: CGFloat = H * 0.50
        let targetXStart: CGFloat = W * 0.18
        let targetSpacing: CGFloat = 45

        for i in 0..<5 {
            let target = createDropTarget(index: i)
            target.position = CGPoint(x: targetXStart + CGFloat(i) * targetSpacing, y: targetY)
            targets.append(target)
            addChild(target)
        }

        // Stand-up targets (sides)
        let leftTarget = createStandupTarget(color: SKColor(red: 1.0, green: 0.3, blue: 0.3, alpha: 1.0))
        leftTarget.position = CGPoint(x: 50, y: H * 0.75)
        leftTarget.name = "standupLeft"
        addChild(leftTarget)

        let rightTarget = createStandupTarget(color: SKColor(red: 0.3, green: 1.0, blue: 0.3, alpha: 1.0))
        rightTarget.position = CGPoint(x: W - 75, y: H * 0.75)
        rightTarget.name = "standupRight"
        addChild(rightTarget)
    }

    func createDropTarget(index: Int) -> SKShapeNode {
        let target = SKShapeNode(rectOf: CGSize(width: 22, height: 8), cornerRadius: 3)
        target.fillColor = SKColor(red: 0.9, green: 0.7, blue: 0.1, alpha: 0.9)
        target.strokeColor = SKColor(red: 1.0, green: 0.9, blue: 0.3, alpha: 1.0)
        target.lineWidth = 2
        target.glowWidth = 3
        target.name = "target_\(index)"

        let body = SKPhysicsBody(rectangleOf: CGSize(width: 22, height: 8))
        body.isDynamic = false
        body.categoryBitMask = PhysicsCategory.target
        body.contactTestBitMask = PhysicsCategory.ball
        body.collisionBitMask = PhysicsCategory.ball
        body.restitution = 0.3
        target.physicsBody = body
        return target
    }

    func createStandupTarget(color: SKColor) -> SKShapeNode {
        let target = SKShapeNode(rectOf: CGSize(width: 8, height: 40), cornerRadius: 3)
        target.fillColor = color.withAlphaComponent(0.4)
        target.strokeColor = color
        target.lineWidth = 3
        target.glowWidth = 4

        let body = SKPhysicsBody(rectangleOf: CGSize(width: 8, height: 40))
        body.isDynamic = false
        body.categoryBitMask = PhysicsCategory.target
        body.contactTestBitMask = PhysicsCategory.ball
        body.collisionBitMask = PhysicsCategory.ball
        body.restitution = 0.5
        target.physicsBody = body
        return target
    }

    // MARK: - Kickers (Slingshots)
    func setupKickers() {
        // Left kicker
        let leftKicker = createKicker(isLeft: true)
        leftKicker.position = CGPoint(x: 55, y: H * 0.35)
        leftKicker.name = "leftKicker"
        kickers.append(leftKicker)
        addChild(leftKicker)

        // Right kicker
        let rightKicker = createKicker(isLeft: false)
        rightKicker.position = CGPoint(x: W - 85, y: H * 0.35)
        rightKicker.name = "rightKicker"
        kickers.append(rightKicker)
        addChild(rightKicker)
    }

    func createKicker(isLeft: Bool) -> SKShapeNode {
        let path = CGMutablePath()
        if isLeft {
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: 45, y: 60))
            path.addLine(to: CGPoint(x: 45, y: 55))
            path.addLine(to: CGPoint(x: 5, y: 0))
            path.closeSubpath()
        } else {
            path.move(to: CGPoint(x: 0, y: 0))
            path.addLine(to: CGPoint(x: -45, y: 60))
            path.addLine(to: CGPoint(x: -45, y: 55))
            path.addLine(to: CGPoint(x: -5, y: 0))
            path.closeSubpath()
        }

        let kicker = SKShapeNode(path: path)
        kicker.fillColor = SKColor(red: 0.8, green: 0.2, blue: 0.8, alpha: 0.4)
        kicker.strokeColor = SKColor(red: 1.0, green: 0.3, blue: 1.0, alpha: 1.0)
        kicker.lineWidth = 3
        kicker.glowWidth = 4

        let body = SKPhysicsBody(polygonFrom: path)
        body.isDynamic = false
        body.categoryBitMask = PhysicsCategory.kicker
        body.contactTestBitMask = PhysicsCategory.ball
        body.collisionBitMask = PhysicsCategory.ball
        body.restitution = 1.5
        body.friction = 0.0
        kicker.physicsBody = body
        return kicker
    }

    // MARK: - Spinners
    func setupSpinners() {
        let spinnerPositions: [(CGFloat, CGFloat)] = [
            (W * 0.22, H * 0.82),
            (W * 0.60, H * 0.82),
        ]

        for (i, pos) in spinnerPositions.enumerated() {
            let spinner = createSpinner(index: i)
            spinner.position = CGPoint(x: pos.0, y: pos.1)
            spinners.append(spinner)
            addChild(spinner)
        }
    }

    func createSpinner(index: Int) -> SKSpriteNode {
        let spinner = SKSpriteNode(color: .clear, size: CGSize(width: 30, height: 30))
        spinner.name = "spinner_\(index)"

        let colors: [SKColor] = [
            SKColor(red: 0.0, green: 1.0, blue: 0.8, alpha: 1.0),
            SKColor(red: 1.0, green: 0.5, blue: 0.0, alpha: 1.0),
        ]
        let color = colors[index % colors.count]

        // Star shape
        for a in stride(from: 0, through: 360, by: 45) {
            let angle = CGFloat(a) * .pi / 180
            let arm = SKShapeNode(rectOf: CGSize(width: 3, height: 14))
            arm.fillColor = color
            arm.strokeColor = .clear
            arm.zRotation = angle
            arm.position = CGPoint(x: cos(angle) * 7, y: sin(angle) * 7)
            spinner.addChild(arm)
        }

        let body = SKPhysicsBody(circleOfRadius: 15)
        body.isDynamic = false
        body.categoryBitMask = PhysicsCategory.spinner
        body.contactTestBitMask = PhysicsCategory.ball
        body.collisionBitMask = PhysicsCategory.none
        spinner.physicsBody = body
        return spinner
    }

    // MARK: - Gates
    func setupGates() {
        // Upper left gate
        let leftGate = createGate(isLeft: true)
        leftGate.position = CGPoint(x: 60, y: H * 0.88)
        leftGate.name = "gateLeft"
        gates.append(leftGate)
        addChild(leftGate)

        // Upper right gate
        let rightGate = createGate(isLeft: false)
        rightGate.position = CGPoint(x: W - 90, y: H * 0.88)
        rightGate.name = "gateRight"
        gates.append(rightGate)
        addChild(rightGate)
    }

    func createGate(isLeft: Bool) -> SKShapeNode {
        let gate = SKShapeNode(rectOf: CGSize(width: 40, height: 6), cornerRadius: 3)
        gate.fillColor = SKColor(red: 0.2, green: 0.8, blue: 0.4, alpha: 0.8)
        gate.strokeColor = SKColor(red: 0.4, green: 1.0, blue: 0.6, alpha: 1.0)
        gate.lineWidth = 2
        gate.glowWidth = 4
        gate.zRotation = isLeft ? CGFloat.pi / 4 : -CGFloat.pi / 4

        let body = SKPhysicsBody(rectangleOf: CGSize(width: 40, height: 6))
        body.isDynamic = false
        body.categoryBitMask = PhysicsCategory.gate
        body.contactTestBitMask = PhysicsCategory.ball
        body.collisionBitMask = PhysicsCategory.ball
        body.restitution = 0.8
        gate.physicsBody = body
        return gate
    }

    // MARK: - Rollovers
    func setupRollovers() {
        let rolloverY: CGFloat = H * 0.93
        let positions: [CGFloat] = [W * 0.30, W * 0.42, W * 0.54]
        let letters = ["P", "I", "N"]

        for (i, x) in positions.enumerated() {
            let ro = SKShapeNode(circleOfRadius: 12)
            ro.position = CGPoint(x: x, y: rolloverY)
            ro.fillColor = SKColor(red: 0.1, green: 0.1, blue: 0.3, alpha: 1.0)
            ro.strokeColor = SKColor(red: 0.4, green: 0.4, blue: 1.0, alpha: 1.0)
            ro.lineWidth = 2
            ro.name = "rollover_\(i)"

            let label = SKLabelNode(text: letters[i])
            label.fontSize = 11
            label.fontName = "Helvetica-Bold"
            label.fontColor = SKColor(red: 0.5, green: 0.5, blue: 1.0, alpha: 1.0)
            label.verticalAlignmentMode = .center
            ro.addChild(label)

            let body = SKPhysicsBody(circleOfRadius: 12)
            body.isDynamic = false
            body.categoryBitMask = PhysicsCategory.gate
            body.contactTestBitMask = PhysicsCategory.ball
            body.collisionBitMask = PhysicsCategory.none
            ro.physicsBody = body

            rollovers.append(ro)
            rolloverstates.append(false)
            addChild(ro)
        }
    }

    // MARK: - Decorative Lights
    func setupLights() {
        // Lane lights along the sides
        for i in 0..<10 {
            let y = H * 0.2 + CGFloat(i) * (H * 0.65 / 10)
            addLightDot(at: CGPoint(x: 28, y: y), color: SKColor(red: 0.0, green: 0.5, blue: 1.0, alpha: 0.7))
            addLightDot(at: CGPoint(x: W - 28, y: y), color: SKColor(red: 0.0, green: 0.5, blue: 1.0, alpha: 0.7))
        }

        // Top arc lights
        for i in 0..<7 {
            let angle = CGFloat(i) / 6 * .pi
            let x = W/2 + cos(angle) * 130
            let y = H - 30 - sin(angle) * 20
            addLightDot(at: CGPoint(x: x, y: y), color: SKColor(red: 1.0, green: 0.8, blue: 0.0, alpha: 0.8))
        }
    }

    func addLightDot(at position: CGPoint, color: SKColor) {
        let light = SKShapeNode(circleOfRadius: 4)
        light.position = position
        light.fillColor = color
        light.strokeColor = color
        light.glowWidth = 3
        light.zPosition = -5
        lights.append(light)
        addChild(light)
    }

    // MARK: - Plunger
    func setupPlunger() {
        // Plunger housing
        let housing = SKShapeNode(rectOf: CGSize(width: 28, height: 100), cornerRadius: 4)
        housing.position = CGPoint(x: W - 37, y: 100)
        housing.fillColor = SKColor(red: 0.15, green: 0.15, blue: 0.3, alpha: 1.0)
        housing.strokeColor = SKColor(red: 0.3, green: 0.3, blue: 0.6, alpha: 1.0)
        housing.lineWidth = 2
        addChild(housing)

        // Power bar background
        let barBg = SKShapeNode(rectOf: CGSize(width: 16, height: 90), cornerRadius: 3)
        barBg.position = CGPoint(x: W - 37, y: 100)
        barBg.fillColor = SKColor(red: 0.05, green: 0.05, blue: 0.1, alpha: 1.0)
        barBg.strokeColor = .clear
        addChild(barBg)

        // Power bar
        plungerBar = SKShapeNode(rectOf: CGSize(width: 14, height: 0), cornerRadius: 2)
        plungerBar.position = CGPoint(x: W - 37, y: 55)
        plungerBar.fillColor = SKColor(red: 0.2, green: 1.0, blue: 0.4, alpha: 1.0)
        plungerBar.strokeColor = .clear
        addChild(plungerBar)

        let launchHint = SKLabelNode(text: "HOLD")
        launchHint.fontSize = 9
        launchHint.fontName = "Helvetica-Bold"
        launchHint.fontColor = SKColor(red: 0.5, green: 0.5, blue: 0.8, alpha: 1.0)
        launchHint.position = CGPoint(x: W - 37, y: 145)
        addChild(launchHint)
    }

    // MARK: - UI
    func setupUI() {
        // Score
        scoreLabel = SKLabelNode(text: "SCORE: 0")
        scoreLabel.fontSize = 20
        scoreLabel.fontName = "Helvetica-Bold"
        scoreLabel.fontColor = SKColor(red: 1.0, green: 0.9, blue: 0.0, alpha: 1.0)
        scoreLabel.position = CGPoint(x: W/2 - 40, y: H - 55)
        scoreLabel.horizontalAlignmentMode = .center
        scoreLabel.zPosition = 10
        addChild(scoreLabel)

        // Lives
        livesLabel = SKLabelNode(text: "●●●")
        livesLabel.fontSize = 18
        livesLabel.fontName = "Helvetica-Bold"
        livesLabel.fontColor = SKColor(red: 1.0, green: 0.3, blue: 0.3, alpha: 1.0)
        livesLabel.position = CGPoint(x: W/2 - 40, y: H - 80)
        livesLabel.horizontalAlignmentMode = .center
        livesLabel.zPosition = 10
        addChild(livesLabel)

        // Multiplier
        multiplierLabel = SKLabelNode(text: "")
        multiplierLabel.fontSize = 24
        multiplierLabel.fontName = "Helvetica-Bold"
        multiplierLabel.fontColor = SKColor(red: 0.0, green: 1.0, blue: 0.8, alpha: 1.0)
        multiplierLabel.position = CGPoint(x: W/2 - 40, y: H - 105)
        multiplierLabel.horizontalAlignmentMode = .center
        multiplierLabel.zPosition = 10
        addChild(multiplierLabel)

        // High score
        highScoreLabel = SKLabelNode(text: "BEST: \(highScore)")
        highScoreLabel.fontSize = 14
        highScoreLabel.fontName = "Helvetica-Bold"
        highScoreLabel.fontColor = SKColor(red: 0.7, green: 0.7, blue: 1.0, alpha: 0.8)
        highScoreLabel.position = CGPoint(x: W/2 - 40, y: H - 125)
        highScoreLabel.horizontalAlignmentMode = .center
        highScoreLabel.zPosition = 10
        addChild(highScoreLabel)

        // Instruction label
        let inst = SKLabelNode(text: "LEFT / RIGHT TAP = FLIPPER")
        inst.fontSize = 10
        inst.fontName = "Helvetica"
        inst.fontColor = SKColor(white: 0.5, alpha: 0.8)
        inst.position = CGPoint(x: W/2 - 40, y: 25)
        inst.horizontalAlignmentMode = .center
        inst.zPosition = 10
        addChild(inst)
    }

    // MARK: - Ball
    func spawnBall() {
        if ball != nil { ball.removeFromParent() }
        ball = SKShapeNode(circleOfRadius: 11)
        ball.position = CGPoint(x: W - 37, y: 175)
        ball.fillColor = SKColor(red: 0.9, green: 0.9, blue: 0.9, alpha: 1.0)
        ball.strokeColor = SKColor(red: 1.0, green: 1.0, blue: 1.0, alpha: 1.0)
        ball.lineWidth = 2
        ball.glowWidth = 4
        ball.name = "ball"
        ball.zPosition = 5

        // Shine
        let shine = SKShapeNode(circleOfRadius: 4)
        shine.position = CGPoint(x: 3, y: 4)
        shine.fillColor = SKColor(white: 1.0, alpha: 0.7)
        shine.strokeColor = .clear
        ball.addChild(shine)

        let body = SKPhysicsBody(circleOfRadius: 11)
        body.isDynamic = true
        body.mass = 0.08
        body.friction = 0.1
        body.restitution = 0.55
        body.linearDamping = 0.15
        body.angularDamping = 0.3
        body.allowsRotation = true
        body.categoryBitMask = PhysicsCategory.ball
        body.collisionBitMask = PhysicsCategory.wall | PhysicsCategory.flipper |
                                 PhysicsCategory.bumper | PhysicsCategory.target |
                                 PhysicsCategory.kicker | PhysicsCategory.gate
        body.contactTestBitMask = PhysicsCategory.bumper | PhysicsCategory.target |
                                   PhysicsCategory.drain | PhysicsCategory.kicker |
                                   PhysicsCategory.spinner | PhysicsCategory.gate
        ball.physicsBody = body

        addChild(ball)
        isBallLaunched = false
        plungerPower = 0
    }

    // MARK: - Light Animation
    func startLightAnimation() {
        let flashAction = SKAction.repeatForever(
            SKAction.sequence([
                SKAction.wait(forDuration: 0.08),
                SKAction.run { [weak self] in self?.flickerLights() }
            ])
        )
        run(flashAction, withKey: "lightFlicker")

        // Spinner rotation
        let spinAction = SKAction.repeatForever(
            SKAction.sequence([
                SKAction.wait(forDuration: 0.05),
                SKAction.run { [weak self] in
                    self?.spinners.forEach { $0.zRotation += 0.05 }
                }
            ])
        )
        run(spinAction, withKey: "spinnerSpin")
    }

    var lightPhase: CGFloat = 0
    func flickerLights() {
        lightPhase += 0.15
        for (i, light) in lights.enumerated() {
            let offset = CGFloat(i) * 0.4
            let brightness = (sin(lightPhase + offset) + 1) / 2
            light.alpha = 0.3 + brightness * 0.7
            let r = brightness
            let b = 1.0 - brightness * 0.5
            light.fillColor = SKColor(red: r, green: r * 0.5, blue: b, alpha: 0.9)
        }
    }

    // MARK: - Touch Handling
    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let loc = touch.location(in: self)

        if isGameOver {
            restartGame()
            return
        }

        if !isBallLaunched {
            isChargingPlunger = true
            return
        }

        if loc.x < W / 2 {
            activateLeftFlipper()
        } else {
            activateRightFlipper()
        }
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        if isChargingPlunger && !isBallLaunched {
            plungerPower = min(plungerPower + 0.04, 1.0)
            updatePlungerBar()
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let loc = touch.location(in: self)

        if isChargingPlunger && !isBallLaunched {
            isChargingPlunger = false
            launchBall()
            return
        }

        if loc.x < W / 2 {
            deactivateLeftFlipper()
        } else {
            deactivateRightFlipper()
        }
    }

    // MARK: - Flipper Control
    func activateLeftFlipper() {
        leftFlipper.physicsBody?.applyAngularImpulse(0.6)
        flashFlipper(leftFlipper)
    }
    func deactivateLeftFlipper() {
        leftFlipper.physicsBody?.applyAngularImpulse(-0.3)
    }
    func activateRightFlipper() {
        rightFlipper.physicsBody?.applyAngularImpulse(-0.6)
        flashFlipper(rightFlipper)
    }
    func deactivateRightFlipper() {
        rightFlipper.physicsBody?.applyAngularImpulse(0.3)
    }

    func flashFlipper(_ flipper: SKSpriteNode) {
        if let shape = flipper.children.first as? SKShapeNode {
            let orig = shape.glowWidth
            let flash = SKAction.sequence([
                SKAction.run { shape.glowWidth = 12 },
                SKAction.wait(forDuration: 0.1),
                SKAction.run { shape.glowWidth = orig }
            ])
            shape.run(flash)
        }
    }

    // MARK: - Plunger
    func updatePlungerBar() {
        plungerBar.removeFromParent()
        let height = plungerPower * 88
        plungerBar = SKShapeNode(rectOf: CGSize(width: 14, height: max(height, 1)), cornerRadius: 2)
        plungerBar.position = CGPoint(x: W - 37, y: 55 + height/2)
        let r = plungerPower
        let g = 1.0 - plungerPower
        plungerBar.fillColor = SKColor(red: r, green: g, blue: 0.1, alpha: 1.0)
        plungerBar.strokeColor = .clear
        plungerBar.zPosition = 8
        addChild(plungerBar)
    }

    func launchBall() {
        let power = plungerPower
        plungerPower = 0
        updatePlungerBar()
        isBallLaunched = true

        let impulse: CGFloat = 8 + power * 22
        ball.physicsBody?.applyImpulse(CGVector(dx: 0, dy: impulse))

        // Launch flash effect
        let flash = SKShapeNode(circleOfRadius: 20)
        flash.position = ball.position
        flash.fillColor = SKColor(red: 1.0, green: 0.9, blue: 0.3, alpha: 0.8)
        flash.strokeColor = .clear
        flash.zPosition = 6
        addChild(flash)
        flash.run(SKAction.sequence([
            SKAction.scale(to: 2.5, duration: 0.15),
            SKAction.fadeOut(withDuration: 0.15),
            SKAction.removeFromParent()
        ]))
    }

    // MARK: - Collision Handling
    func didBegin(_ contact: SKPhysicsContact) {
        let maskA = contact.bodyA.categoryBitMask
        let maskB = contact.bodyB.categoryBitMask

        let combined = maskA | maskB

        if combined == PhysicsCategory.ball | PhysicsCategory.bumper {
            let bumperNode = (maskA == PhysicsCategory.bumper) ? contact.bodyA.node : contact.bodyB.node
            hitBumper(bumperNode)
        } else if combined == PhysicsCategory.ball | PhysicsCategory.target {
            let targetNode = (maskA == PhysicsCategory.target) ? contact.bodyA.node : contact.bodyB.node
            hitTarget(targetNode)
        } else if combined == PhysicsCategory.ball | PhysicsCategory.drain {
            ballDrained()
        } else if combined == PhysicsCategory.ball | PhysicsCategory.kicker {
            hitKicker()
        } else if combined == PhysicsCategory.ball | PhysicsCategory.spinner {
            let spinnerNode = (maskA == PhysicsCategory.spinner) ? contact.bodyA.node : contact.bodyB.node
            hitSpinner(spinnerNode)
        } else if combined == PhysicsCategory.ball | PhysicsCategory.gate {
            hitGateOrRollover(contact)
        }
    }

    // MARK: - Hit Effects
    func hitBumper(_ node: SKNode?) {
        guard let bumper = node as? SKShapeNode else { return }

        bumperHitCount += 1
        let pts = 100 * multiplier
        score += pts

        // Flash the bumper
        let origColor = bumper.strokeColor
        bumper.run(SKAction.sequence([
            SKAction.run {
                bumper.fillColor = bumper.strokeColor.withAlphaComponent(0.9)
                bumper.glowWidth = 20
            },
            SKAction.wait(forDuration: 0.12),
            SKAction.run {
                bumper.fillColor = origColor.withAlphaComponent(0.3)
                bumper.glowWidth = 6
            }
        ]))

        // Score popup
        showFloatingScore(pts, at: bumper.position, color: bumper.strokeColor)

        // Scale pulse
        bumper.run(SKAction.sequence([
            SKAction.scale(to: 1.3, duration: 0.06),
            SKAction.scale(to: 1.0, duration: 0.1)
        ]))

        // Check multiplier
        if bumperHitCount % 10 == 0 && multiplier < 5 {
            multiplier += 1
            showMultiplierUp()
        }
    }

    func hitTarget(_ node: SKNode?) {
        guard let target = node as? SKShapeNode, target.alpha > 0.3 else { return }

        targetHitCount += 1
        let pts = 500 * multiplier
        score += pts

        // Target knocked down animation
        target.run(SKAction.sequence([
            SKAction.run { target.fillColor = SKColor(red: 0.3, green: 0.3, blue: 0.3, alpha: 0.6) },
            SKAction.scale(to: CGSize(width: 22, height: 2), duration: 0.12),
            SKAction.run {
                target.physicsBody?.categoryBitMask = PhysicsCategory.none
                target.alpha = 0.3
            }
        ]))

        showFloatingScore(pts, at: target.position, color: SKColor(red: 1.0, green: 0.9, blue: 0.2, alpha: 1.0))

        // Reset all targets if all knocked down
        let activeTargets = targets.filter { $0.alpha > 0.3 && $0.name?.hasPrefix("target_") == true }
        if activeTargets.isEmpty {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                self?.resetDropTargets()
                self?.score += 2000 * (self?.multiplier ?? 1)
            }
        }
    }

    func resetDropTargets() {
        for target in targets where target.name?.hasPrefix("target_") == true {
            target.run(SKAction.sequence([
                SKAction.fadeIn(withDuration: 0.3),
                SKAction.run {
                    target.physicsBody?.categoryBitMask = PhysicsCategory.target
                    target.fillColor = SKColor(red: 0.9, green: 0.7, blue: 0.1, alpha: 0.9)
                }
            ]))
            target.run(SKAction.scale(to: CGSize(width: 22, height: 8), duration: 0.3))
        }

        let bonus = SKLabelNode(text: "BONUS! +2000")
        bonus.fontSize = 22
        bonus.fontName = "Helvetica-Bold"
        bonus.fontColor = SKColor(red: 1.0, green: 0.8, blue: 0.0, alpha: 1.0)
        bonus.position = CGPoint(x: W/2 - 40, y: H * 0.5)
        bonus.zPosition = 20
        addChild(bonus)
        bonus.run(SKAction.sequence([
            SKAction.group([
                SKAction.moveBy(x: 0, y: 40, duration: 0.8),
                SKAction.sequence([
                    SKAction.wait(forDuration: 0.5),
                    SKAction.fadeOut(withDuration: 0.3)
                ])
            ]),
            SKAction.removeFromParent()
        ]))
    }

    func hitKicker() {
        let pts = 150 * multiplier
        score += pts

        // Flash both kickers
        for kicker in kickers {
            kicker.run(SKAction.sequence([
                SKAction.run { kicker.fillColor = kicker.strokeColor.withAlphaComponent(0.9) },
                SKAction.wait(forDuration: 0.1),
                SKAction.run { kicker.fillColor = kicker.strokeColor.withAlphaComponent(0.4) }
            ]))
        }

        showFloatingScore(pts, at: ball.position, color: SKColor(red: 1.0, green: 0.3, blue: 1.0, alpha: 1.0))
    }

    func hitSpinner(_ node: SKNode?) {
        guard let spinner = node as? SKSpriteNode else { return }
        let pts = 50 * multiplier
        score += pts

        // Spin faster
        let fastSpin = SKAction.rotate(byAngle: CGFloat.pi * 4, duration: 0.4)
        spinner.run(fastSpin)

        // Flash
        spinner.run(SKAction.sequence([
            SKAction.colorize(with: .white, colorBlendFactor: 1.0, duration: 0.05),
            SKAction.colorize(with: .clear, colorBlendFactor: 0, duration: 0.2)
        ]))
    }

    func hitGateOrRollover(_ contact: SKPhysicsContact) {
        let maskA = contact.bodyA.categoryBitMask
        let node = (maskA == PhysicsCategory.gate) ? contact.bodyA.node : contact.bodyB.node

        if let ro = node, ro.name?.hasPrefix("rollover_") == true,
           let idx = Int(ro.name!.replacingOccurrences(of: "rollover_", with: "")) {
            if !rolloverstates[idx] {
                rolloverstates[idx] = true
                score += 300 * multiplier
                if let shape = ro as? SKShapeNode {
                    shape.fillColor = SKColor(red: 0.3, green: 0.3, blue: 1.0, alpha: 0.9)
                    if let lbl = shape.children.first as? SKLabelNode {
                        lbl.fontColor = .white
                    }
                }

                if rolloverstates.allSatisfy({ $0 }) {
                    rolloverstates = rolloverstates.map { _ in false }
                    score += 1000 * multiplier
                    showBonusText("PIN BONUS! +1000")
                    for ro2 in rollovers {
                        if let shape = ro2 as? SKShapeNode {
                            shape.fillColor = SKColor(red: 0.1, green: 0.1, blue: 0.3, alpha: 1.0)
                            if let lbl = shape.children.first as? SKLabelNode {
                                lbl.fontColor = SKColor(red: 0.5, green: 0.5, blue: 1.0, alpha: 1.0)
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Ball Drain
    func ballDrained() {
        guard isBallLaunched else { return }
        isBallLaunched = false

        // Drain flash effect
        let flash = SKSpriteNode(color: SKColor(red: 1.0, green: 0.0, blue: 0.0, alpha: 0.4),
                                  size: CGSize(width: W, height: H))
        flash.position = CGPoint(x: W/2, y: H/2)
        flash.zPosition = 50
        addChild(flash)
        flash.run(SKAction.sequence([
            SKAction.wait(forDuration: 0.2),
            SKAction.fadeOut(withDuration: 0.3),
            SKAction.removeFromParent()
        ]))

        lives -= 1
        multiplier = 1

        if lives <= 0 {
            gameOver()
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                self?.spawnBall()
            }
        }
    }

    // MARK: - Game Over
    func gameOver() {
        isGameOver = true
        ball?.physicsBody?.isDynamic = false

        let overlay = SKShapeNode(rectOf: CGSize(width: W - 60, height: 280), cornerRadius: 20)
        overlay.position = CGPoint(x: W/2 - 40, y: H/2)
        overlay.fillColor = SKColor(red: 0.05, green: 0.05, blue: 0.2, alpha: 0.95)
        overlay.strokeColor = SKColor(red: 0.5, green: 0.3, blue: 1.0, alpha: 1.0)
        overlay.lineWidth = 3
        overlay.glowWidth = 8
        overlay.zPosition = 100
        overlay.name = "gameOverOverlay"
        addChild(overlay)

        let title = SKLabelNode(text: "GAME OVER")
        title.fontSize = 32
        title.fontName = "Helvetica-Bold"
        title.fontColor = SKColor(red: 1.0, green: 0.2, blue: 0.3, alpha: 1.0)
        title.position = CGPoint(x: 0, y: 90)
        overlay.addChild(title)

        let finalScore = SKLabelNode(text: "SCORE: \(score)")
        finalScore.fontSize = 22
        finalScore.fontName = "Helvetica-Bold"
        finalScore.fontColor = SKColor(red: 1.0, green: 0.9, blue: 0.0, alpha: 1.0)
        finalScore.position = CGPoint(x: 0, y: 40)
        overlay.addChild(finalScore)

        let bestScore = SKLabelNode(text: "BEST: \(highScore)")
        bestScore.fontSize = 18
        bestScore.fontName = "Helvetica"
        bestScore.fontColor = SKColor(red: 0.7, green: 0.7, blue: 1.0, alpha: 1.0)
        bestScore.position = CGPoint(x: 0, y: 5)
        overlay.addChild(bestScore)

        let tapToPlay = SKLabelNode(text: "TAP TO PLAY AGAIN")
        tapToPlay.fontSize = 16
        tapToPlay.fontName = "Helvetica-Bold"
        tapToPlay.fontColor = SKColor(red: 0.3, green: 1.0, blue: 0.5, alpha: 1.0)
        tapToPlay.position = CGPoint(x: 0, y: -50)
        overlay.addChild(tapToPlay)

        tapToPlay.run(SKAction.repeatForever(SKAction.sequence([
            SKAction.fadeOut(withDuration: 0.6),
            SKAction.fadeIn(withDuration: 0.6)
        ])))

        // Pulse the overlay
        overlay.run(SKAction.repeatForever(SKAction.sequence([
            SKAction.scale(to: 1.02, duration: 0.8),
            SKAction.scale(to: 1.0, duration: 0.8)
        ])))
    }

    func restartGame() {
        isGameOver = false
        score = 0
        lives = 3
        multiplier = 1
        bumperHitCount = 0
        targetHitCount = 0
        rolloverstates = rolloverstates.map { _ in false }

        childNode(withName: "gameOverOverlay")?.removeFromParent()
        for ro in rollovers {
            if let shape = ro as? SKShapeNode {
                shape.fillColor = SKColor(red: 0.1, green: 0.1, blue: 0.3, alpha: 1.0)
            }
        }
        resetDropTargets()
        spawnBall()
    }

    // MARK: - Helpers
    func showFloatingScore(_ pts: Int, at position: CGPoint, color: SKColor) {
        let label = SKLabelNode(text: "+\(pts)")
        label.fontSize = 16
        label.fontName = "Helvetica-Bold"
        label.fontColor = color
        label.position = position
        label.zPosition = 15
        addChild(label)

        label.run(SKAction.sequence([
            SKAction.group([
                SKAction.moveBy(x: CGFloat.random(in: -20...20), y: 50, duration: 0.7),
                SKAction.sequence([
                    SKAction.wait(forDuration: 0.4),
                    SKAction.fadeOut(withDuration: 0.3)
                ])
            ]),
            SKAction.removeFromParent()
        ]))
    }

    func showMultiplierUp() {
        let label = SKLabelNode(text: "×\(multiplier) MULTIPLIER!")
        label.fontSize = 26
        label.fontName = "Helvetica-Bold"
        label.fontColor = SKColor(red: 0.0, green: 1.0, blue: 0.8, alpha: 1.0)
        label.position = CGPoint(x: W/2 - 40, y: H * 0.45)
        label.zPosition = 20
        addChild(label)

        label.run(SKAction.sequence([
            SKAction.group([
                SKAction.scale(to: 1.4, duration: 0.2),
                SKAction.sequence([
                    SKAction.scale(to: 1.4, duration: 0.2),
                    SKAction.scale(to: 1.0, duration: 0.2)
                ])
            ]),
            SKAction.wait(forDuration: 0.8),
            SKAction.sequence([
                SKAction.moveBy(x: 0, y: 30, duration: 0.4),
                SKAction.fadeOut(withDuration: 0.4)
            ]),
            SKAction.removeFromParent()
        ]))
    }

    func showBonusText(_ text: String) {
        let label = SKLabelNode(text: text)
        label.fontSize = 24
        label.fontName = "Helvetica-Bold"
        label.fontColor = SKColor(red: 1.0, green: 1.0, blue: 0.0, alpha: 1.0)
        label.position = CGPoint(x: W/2 - 40, y: H * 0.4)
        label.zPosition = 20
        addChild(label)

        label.run(SKAction.sequence([
            SKAction.scale(to: 1.3, duration: 0.15),
            SKAction.scale(to: 1.0, duration: 0.15),
            SKAction.wait(forDuration: 0.7),
            SKAction.group([
                SKAction.moveBy(x: 0, y: 40, duration: 0.5),
                SKAction.fadeOut(withDuration: 0.5)
            ]),
            SKAction.removeFromParent()
        ]))
    }
}
