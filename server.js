// server.js
// Multiplayer Study Guide Game – NCLEX/Chapter 67 style

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files in /public
app.use(express.static(path.join(__dirname, "public")));

/* ---------------------------------------------------------
   Room state
   --------------------------------------------------------- */

const rooms = {}; // { ROOMCODE: { hostId, currentQuestionIndex, players: { socketId: { name, readyForNext, score } } } }

function generateRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}

/* ---------------------------------------------------------
   QUESTIONS – 30 NCLEX / SATA style (Chapter 67 ortho/trauma style)
   --------------------------------------------------------- */

const QUESTIONS = [
  // 1–15: SINGLE-ANSWER
  {
    type: "single",
    question:
      "The nurse is caring for a client with a newly applied long-leg cast after a tibial fracture. Which assessment finding requires IMMEDIATE follow-up?",
    choices: [
      "Mild tingling that improves after elevating the leg",
      "Warm toes with brisk capillary refill",
      "Pain that continues to increase despite IV opioids",
      "Slight swelling controlled with ice and elevation"
    ],
    correct: [2],
    explanation:
      "Progressively increasing pain unrelieved by opioids is a classic early sign of compartment syndrome, a limb-threatening emergency."
  },
  {
    type: "single",
    question:
      "The nurse is admitting a client with a closed femur fracture. Which finding places the client at greatest risk for fat embolism syndrome?",
    choices: [
      "History of rheumatoid arthritis",
      "Fracture of the distal radius 6 months ago",
      "Long-bone fracture involving the femur shaft",
      "Obesity and history of gallbladder disease"
    ],
    correct: [2],
    explanation:
      "Long-bone fractures (especially the femur and pelvis) are strongly associated with fat embolism syndrome in the first 24–72 hours."
  },
  {
    type: "single",
    question:
      "The nurse cares for a client post–total hip arthroplasty. Which statement indicates the client needs MORE teaching?",
    choices: [
      "“I will avoid crossing my legs when I sit.”",
      "“I should avoid bending at the hip more than 90 degrees.”",
      "“I will use a raised toilet seat at home.”",
      "“I will sleep on my operated side with my legs crossed to stay comfortable.”"
    ],
    correct: [3],
    explanation:
      "After hip replacement, clients must avoid hip flexion > 90°, adduction (crossing legs), and internal rotation to prevent dislocation."
  },
  {
    type: "single",
    question:
      "The nurse suspects compartment syndrome in a client with a casted forearm. Which provider order should the nurse QUESTION?",
    choices: [
      "Elevate the extremity at heart level",
      "Notify the orthopedic surgeon immediately",
      "Apply ice packs intermittently",
      "Elevate the arm above heart level on several pillows"
    ],
    correct: [3],
    explanation:
      "In compartment syndrome, excessive elevation above heart level can further reduce arterial perfusion; limb is usually kept at heart level."
  },
  {
    type: "single",
    question:
      "A post-op client with open reduction internal fixation (ORIF) of a femur suddenly develops dyspnea, confusion, and a petechial rash on the chest. What is the PRIORITY action?",
    choices: [
      "Increase the IV fluid rate",
      "Apply high-flow oxygen via nonrebreather mask",
      "Elevate the legs above heart level",
      "Administer PRN morphine for pain"
    ],
    correct: [1],
    explanation:
      "These are signs of fat embolism syndrome. Priority is to support oxygenation with high-flow O₂ while notifying the provider."
  },
  {
    type: "single",
    question:
      "The nurse is caring for a client in Buck’s traction awaiting hip fracture surgery. Which action is MOST important?",
    choices: [
      "Remove the weights every 2 hours to check the skin",
      "Ensure the weights hang freely and do not rest on the floor",
      "Elevate the foot of the bed so the weights rest against the frame",
      "Encourage the client to sit upright in a chair for meals"
    ],
    correct: [1],
    explanation:
      "For traction to be effective, weights must hang freely and not rest on the bed or floor."
  },
  {
    type: "single",
    question:
      "Which nutrient recommendation is MOST important to promote bone healing after a fracture?",
    choices: [
      "Increase intake of protein, calcium, and vitamin D",
      "Avoid foods high in phosphorus",
      "Limit carbohydrates to reduce inflammation",
      "Follow a low-residue diet"
    ],
    correct: [0],
    explanation:
      "Protein supports collagen matrix, while calcium and vitamin D support bone remodeling and mineralization."
  },
  {
    type: "single",
    question:
      "The nurse is assessing a client in skeletal traction for a femur fracture. Which assessment requires prompt follow-up?",
    choices: [
      "Weights hanging freely at the foot of the bed",
      "Reports of pain that improves with prescribed analgesics",
      "Pin sites with minimal serous drainage",
      "Ropes lying slack with weights touching the bed frame"
    ],
    correct: [3],
    explanation:
      "Ropes must be taut and weights must hang freely; weights touching the frame reduce traction effectiveness."
  },
  {
    type: "single",
    question:
      "The nurse prepares to discharge a client with a new diagnosis of carpal tunnel syndrome. Which statement indicates understanding of conservative management?",
    choices: [
      "“I should wear a wrist splint at night to keep my wrist straight.”",
      "“I’ll sleep with my wrists bent to reduce pressure.”",
      "“I should increase heavy lifting to strengthen my hands.”",
      "“I will keep typing without breaks to build endurance.”"
    ],
    correct: [0],
    explanation:
      "A neutral-position wrist splint, especially at night, reduces median nerve compression in carpal tunnel."
  },
  {
    type: "single",
    question:
      "The nurse is caring for a client with an open tibial fracture. What is the PRIORITY action on admission to the emergency department?",
    choices: [
      "Cover the wound with a sterile dressing",
      "Apply warm compresses to the wound",
      "Manually realign the bone ends immediately",
      "Apply a topical antibiotic ointment directly to the bone"
    ],
    correct: [0],
    explanation:
      "Open fractures have high infection risk; priority is to cover the wound with a sterile dressing until debridement."
  },
  {
    type: "single",
    question:
      "Which neurovascular assessment finding in a client with a casted arm should be reported to the provider FIRST?",
    choices: [
      "Capillary refill of 3 seconds in the fingers",
      "Slight numbness that resolves with repositioning",
      "Inability to move the fingers and absent radial pulse",
      "Mild swelling controlled with elevation"
    ],
    correct: [2],
    explanation:
      "Absent pulses and inability to move fingers indicate severe neurovascular compromise requiring immediate intervention."
  },
  {
    type: "single",
    question:
      "The nurse is triaging four clients. Which client should be seen FIRST?",
    choices: [
      "Client with a wrist sprain who reports 3/10 pain",
      "Client with a casted leg who reports increasing tightness and severe pain",
      "Client with chronic low back pain requesting medication refill",
      "Client with crutches who slipped but denies injury"
    ],
    correct: [1],
    explanation:
      "Severe, increasing pain in a casted limb suggests possible compartment syndrome, which is limb-threatening."
  },
  {
    type: "single",
    question:
      "A client with an osteoporotic hip fracture asks how to prevent future falls at home. Which nurse response is BEST?",
    choices: [
      "“Keep your home dimly lit so your eyes adjust.”",
      "“Place throw rugs in the hallway to soften any falls.”",
      "“Install grab bars and remove clutter from walking paths.”",
      "“Avoid using assistive devices so you don’t become dependent.”"
    ],
    correct: [2],
    explanation:
      "Fall prevention includes removing hazards, using grab bars, and keeping walking paths clear and well lit."
  },
  {
    type: "single",
    question:
      "The nurse reviews lab results for a client with a non-healing fracture. Which lab value is MOST concerning?",
    choices: [
      "Serum calcium slightly elevated",
      "Low serum albumin level",
      "Normal vitamin D level",
      "Slightly elevated white blood cell count"
    ],
    correct: [1],
    explanation:
      "Low albumin indicates poor nutrition, which can significantly delay fracture healing."
  },
  {
    type: "single",
    question:
      "The nurse teaches a client how to use crutches with a three-point gait. Which instruction is MOST important for safety?",
    choices: [
      "“Bear weight on your axillae to support your body.”",
      "“Keep the crutches slightly ahead and to the side of your feet.”",
      "“Look at your feet when walking to avoid tripping.”",
      "“Place both crutches on the affected side for better balance.”"
    ],
    correct: [1],
    explanation:
      "Crutches should be positioned slightly in front and to the side, with weight on the hands, not axillae."
  },
  {
    type: "single",
    question:
      "A client in a long leg cast asks about controlling discomfort without more medication. Which nurse suggestion is MOST appropriate?",
    choices: [
      "“Lower your leg below heart level to improve circulation.”",
      "“Elevate your leg above heart level and apply ice as directed.”",
      "“Insert a small object into the cast to scratch if you itch.”",
      "“Walk on the cast as much as possible to adapt to it.”"
    ],
    correct: [1],
    explanation:
      "Elevation and ice (if ordered) reduce swelling and pain. Inserting objects and early heavy weight-bearing are unsafe."
  },

  // 16–30: SATA
  {
    type: "multi",
    question:
      "The nurse assesses a client with a casted forearm for compartment syndrome. Which findings are consistent with this complication? (Select all that apply.)",
    choices: [
      "Severe pain with passive finger extension",
      "Paresthesia (numbness/tingling) in the fingers",
      "Warm fingers with brisk capillary refill",
      "Increasing tightness or pressure in the forearm",
      "Pain relieved completely with opioid medication"
    ],
    correct: [0, 1, 3],
    explanation:
      "Compartment syndrome is suggested by severe pain with passive stretch, paresthesia, and increasing compartment pressure."
  },
  {
    type: "multi",
    question:
      "The nurse teaches a client with a new leg cast about cast care. Which statements indicate understanding? (Select all that apply.)",
    choices: [
      "“I will keep my cast clean and dry.”",
      "“I’ll call my provider if my toes become very cold or pale.”",
      "“I can put powder inside the cast to keep my skin dry.”",
      "“I’ll elevate my leg above my heart when I rest.”",
      "“If the cast cracks, I’ll wrap it tightly with tape.”"
    ],
    correct: [0, 1, 3],
    explanation:
      "Correct cast care: keep cast dry, elevate to reduce swelling, and report circulation changes."
  },
  {
    type: "multi",
    question:
      "The nurse teaches methods to prevent venous thromboembolism (VTE) after lower-extremity surgery. Which client statements show correct understanding? (Select all that apply.)",
    choices: [
      "“I will perform ankle pump exercises regularly.”",
      "“I should report sudden shortness of breath or chest pain right away.”",
      "“Crossing my legs in the chair will improve blood flow.”",
      "“I’ll wear my compression stockings as prescribed.”",
      "“I should avoid walking until my leg is fully healed.”"
    ],
    correct: [0, 1, 3],
    explanation:
      "Ankle pumps, compression stockings, early ambulation, and prompt reporting of dyspnea/chest pain help prevent and detect VTE."
  },
  {
    type: "multi",
    question:
      "A nurse is caring for a client in skeletal traction. Which actions demonstrate correct nursing care? (Select all that apply.)",
    choices: [
      "Ensure weights hang freely and do not touch the floor",
      "Check alignment of the body and traction line regularly",
      "Remove weights daily to provide skin rest unless ordered otherwise",
      "Assess skin integrity and pressure points frequently",
      "Use a trapeze to help the client reposition within limits"
    ],
    correct: [0, 1, 3, 4],
    explanation:
      "Traction care: free-hanging weights, alignment, frequent skin assessments, and trapeze for repositioning. Weights are not removed unless ordered."
  },
  {
    type: "multi",
    question:
      "The nurse is reinforcing discharge teaching after a total hip arthroplasty. Which instructions are appropriate? (Select all that apply.)",
    choices: [
      "Use an abduction pillow between the legs when lying in bed",
      "Avoid bending at the hip more than 90 degrees",
      "Sit only in low chairs and sofas to keep the hips flexed",
      "Use a raised toilet seat when possible",
      "Avoid crossing legs at the knees or ankles"
    ],
    correct: [0, 1, 3, 4],
    explanation:
      "Prevent dislocation by maintaining abduction, avoiding hip flexion > 90°, using raised seats, and not crossing legs."
  },
  {
    type: "multi",
    question:
      "A client with an external fixator for a tibial fracture asks about infection prevention. Which nursing measures are appropriate? (Select all that apply.)",
    choices: [
      "Perform pin-site care per facility protocol",
      "Monitor pin sites for redness, swelling, or drainage",
      "Use strict hand hygiene before touching the pin area",
      "Ignore small drainage unless the client is febrile",
      "Teach the client to report increasing pain at pin sites"
    ],
    correct: [0, 1, 2, 4],
    explanation:
      "Pin-site care, monitoring for local signs, hand hygiene, and reporting pain help detect and prevent infection."
  },
  {
    type: "multi",
    question:
      "Which findings are associated with fat embolism syndrome in a client with a long-bone fracture? (Select all that apply.)",
    choices: [
      "Acute confusion or agitation",
      "Petechial rash on chest and neck",
      "Dyspnea and tachypnea",
      "Localized calf tenderness only",
      "Fever and tachycardia"
    ],
    correct: [0, 1, 2, 4],
    explanation:
      "Fat embolism: respiratory distress, petechiae, neurologic changes, and often fever/tachycardia."
  },
  {
    type: "multi",
    question:
      "The nurse performs a neurovascular assessment on a client with a casted leg. Which components must be included? (Select all that apply.)",
    choices: [
      "Pain level and changes in pain",
      "Skin color and temperature distal to the injury",
      "Peripheral pulses and capillary refill",
      "Sensation and movement of toes",
      "Daily weight and fluid balance"
    ],
    correct: [0, 1, 2, 3],
    explanation:
      "Neurovascular checks = pain, color, temperature, pulses, cap refill, sensation, and movement."
  },
  {
    type: "multi",
    question:
      "The nurse cares for a client immobilized in traction. Which interventions help reduce the risk of pressure injuries? (Select all that apply.)",
    choices: [
      "Use a pressure-redistribution mattress or overlay",
      "Encourage weight shifting and repositioning within traction limits",
      "Keep bed linens smooth and wrinkle-free",
      "Limit skin assessment to once per day",
      "Pad bony prominences appropriately"
    ],
    correct: [0, 1, 2, 4],
    explanation:
      "Pressure injury prevention: support surfaces, frequent repositioning, smooth linens, and padding. Skin checks should be frequent."
  },
  {
    type: "multi",
    question:
      "Which findings should be reported immediately as possible signs of hip prosthesis dislocation? (Select all that apply.)",
    choices: [
      "Sudden severe hip pain",
      "Shortening of the affected leg",
      "External or internal rotation of the leg",
      "Slight soreness at the incision site",
      "Inability to move the leg or bear weight"
    ],
    correct: [0, 1, 2, 4],
    explanation:
      "Signs of dislocation: acute pain, leg shortening, abnormal rotation, and loss of function."
  },
  {
    type: "multi",
    question:
      "The nurse teaches strategies to prevent repetitive strain injuries in nursing students. Which statements demonstrate correct understanding? (Select all that apply.)",
    choices: [
      "“I will use ergonomic keyboards and wrist supports when typing.”",
      "“I’ll take short, frequent breaks from repetitive tasks.”",
      "“I should maintain a neutral wrist position while charting.”",
      "“Working nonstop without breaks will help me finish faster and is safer.”",
      "“I’ll adjust my chair and desk height to support good posture.”"
    ],
    correct: [0, 1, 2, 4],
    explanation:
      "Prevention relies on ergonomic equipment, breaks, neutral joint positions, and good posture."
  },
  {
    type: "multi",
    question:
      "The nurse is caring for a client post–open reduction internal fixation (ORIF) of the femur. Which post-op interventions are appropriate? (Select all that apply.)",
    choices: [
      "Monitor the surgical site for excessive drainage or bleeding",
      "Assess neurovascular status of the affected limb frequently",
      "Encourage deep breathing and use of incentive spirometer",
      "Instruct the client to avoid any movement of toes",
      "Administer analgesics and evaluate pain relief"
    ],
    correct: [0, 1, 2, 4],
    explanation:
      "Post-op ORIF care includes incision monitoring, neurovascular checks, pulmonary hygiene, and pain management. Toe movement should be encouraged."
  },
  {
    type: "multi",
    question:
      "Which clients are at increased risk for delayed fracture healing? (Select all that apply.)",
    choices: [
      "Client who smokes one pack per day",
      "Older adult with poor nutritional intake",
      "Young athlete with high protein diet",
      "Client with uncontrolled diabetes mellitus",
      "Client taking long-term corticosteroids"
    ],
    correct: [0, 1, 3, 4],
    explanation:
      "Smoking, malnutrition, diabetes, and long-term steroid use all impair healing and remodeling."
  },
  {
    type: "multi",
    question:
      "The nurse reinforces RICE teaching for an acute ankle sprain. Which client actions are appropriate? (Select all that apply.)",
    choices: [
      "Rest the ankle and avoid weight-bearing initially",
      "Apply ice packs for 20 minutes at a time several times per day",
      "Wrap the ankle with an elastic bandage for compression",
      "Keep the ankle dependent to increase blood flow",
      "Elevate the ankle above heart level when sitting or lying"
    ],
    correct: [0, 1, 2, 4],
    explanation:
      "RICE: Rest, Ice, Compression, Elevation. The limb should be elevated, not dependent, to reduce swelling."
  },
  {
    type: "multi",
    question:
      "The nurse teaches home safety for a client using a walker after hip fracture repair. Which suggestions are appropriate? (Select all that apply.)",
    choices: [
      "Remove loose throw rugs from walking areas",
      "Ensure hallways and stairs are well lit",
      "Keep frequently used items within easy reach",
      "Walk in socks on hardwood floors to reduce friction",
      "Install grab bars in the bathroom near the toilet and shower"
    ],
    correct: [0, 1, 2, 4],
    explanation:
      "Fall prevention: remove rugs, maintain good lighting, keep items close, and use grab bars. Socks on hard floors increase slip risk."
  },
  {
    type: "multi",
    question:
      "The nurse monitors a client with a pelvic fracture. Which findings may indicate developing hypovolemic shock or serious complication? (Select all that apply.)",
    choices: [
      "Tachycardia and hypotension",
      "Cool, clammy skin",
      "Decreasing urine output",
      "Warm skin and bounding pulses",
      "Restlessness and anxiety"
    ],
    correct: [0, 1, 2, 4],
    explanation:
      "Pelvic fractures can cause internal bleeding. Signs of shock: tachycardia, hypotension, cool clammy skin, oliguria, and anxiety/restlessness."
  },
  {
    type: "multi",
    question:
      "The nurse evaluates a client with a leg cast for possible infection. Which findings are most concerning? (Select all that apply.)",
    choices: [
      "Localized warmth and redness near the cast edge",
      "Purulent drainage or foul odor from inside the cast",
      "Low-grade fever and malaise",
      "Mild itching without other symptoms",
      "Increasing pain and swelling not relieved by elevation"
    ],
    correct: [0, 1, 2, 4],
    explanation:
      "Infection signs: warmth/redness, purulent drainage/odor, systemic fever/malaise, and worsening pain/swelling."
  }
];

/* ---------------------------------------------------------
   Socket.io game logic
   --------------------------------------------------------- */

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Host creates a room
  socket.on("host-create-room", () => {
    let code;
    do {
      code = generateRoomCode();
    } while (rooms[code]);

    rooms[code] = {
      hostId: socket.id,
      currentQuestionIndex: 0,
      players: {} // socketId -> { name, readyForNext, score }
    };

    socket.join(code);
    socket.emit("room-created", { roomCode: code });
    console.log(`Room created: ${code}`);
  });

  // Player joins a room
  socket.on("player-join", ({ roomCode, name }) => {
    const normalizedCode = (roomCode || "").toUpperCase();
    const room = rooms[normalizedCode];

    if (!room) {
      socket.emit("join-error", { message: "Room not found." });
      return;
    }

    socket.join(normalizedCode);
    room.players[socket.id] = {
      name,
      readyForNext: false,
      score: 0
    };

    socket.emit("join-success", { roomCode: normalizedCode, name });

    io.to(room.hostId).emit("players-updated", {
      players: Object.values(room.players)
    });

    console.log(`Player ${name} joined room ${normalizedCode}`);
  });

  // Host starts the game
  socket.on("host-start-game", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;

    room.currentQuestionIndex = 0;
    resetReady(room);

    const question = QUESTIONS[room.currentQuestionIndex];
    io.to(roomCode).emit("new-question", {
      index: room.currentQuestionIndex,
      total: QUESTIONS.length,
      question
    });

    console.log(`Game started in room ${roomCode}`);
  });

  // Player submits an answer
  socket.on("player-answer", ({ roomCode, selectedIndices }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const qIdx = room.currentQuestionIndex;
    const question = QUESTIONS[qIdx];
    if (!question) return;

    const correctIndices = [...question.correct].sort((a, b) => a - b);
    const chosen = [...selectedIndices].sort((a, b) => a - b);

    const isCorrect =
      correctIndices.length === chosen.length &&
      correctIndices.every((val, idx) => val === chosen[idx]);

    const player = room.players[socket.id];
    if (player && isCorrect) {
      player.score += 1;
    }

    // Feedback only to that player
    io.to(socket.id).emit("answer-result", {
      isCorrect,
      correctIndices,
      explanation: question.explanation
    });

    // Update host's player list with scores
    io.to(room.hostId).emit("players-updated", {
      players: Object.values(room.players)
    });
  });

  // Player ready for next question
  socket.on("player-ready-next", ({ roomCode }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players[socket.id];
    if (!player) return;

    player.readyForNext = true;

    const allReady =
      Object.values(room.players).length > 0 &&
      Object.values(room.players).every((p) => p.readyForNext);

    if (allReady) {
      room.currentQuestionIndex++;

      if (room.currentQuestionIndex >= QUESTIONS.length) {
        io.to(roomCode).emit("game-over", {
          totalQuestions: QUESTIONS.length,
          players: Object.values(room.players)
        });
        console.log(`Game over in room ${roomCode}`);
      } else {
        resetReady(room);
        const question = QUESTIONS[room.currentQuestionIndex];
        io.to(roomCode).emit("new-question", {
          index: room.currentQuestionIndex,
          total: QUESTIONS.length,
          question
        });
      }
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
    for (const [code, room] of Object.entries(rooms)) {
      // If host left: close room
      if (room.hostId === socket.id) {
        io.to(code).emit("room-closed");
        delete rooms[code];
        console.log(`Room ${code} closed (host disconnected).`);
        continue;
      }
      // If player left: remove from room
      if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(room.hostId).emit("players-updated", {
          players: Object.values(room.players)
        });
      }
    }
  });
});

function resetReady(room) {
  Object.values(room.players).forEach((p) => {
    p.readyForNext = false;
  });
}

/* ---------------------------------------------------------
   Start server
   --------------------------------------------------------- */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
