"use strict";

/**
 * Bộ câu hỏi Chương 6 – Vấn đề dân tộc và tôn giáo trong thời kỳ quá độ lên CNXH.
 *
 * File này CHỈ nằm trên server. Trường `correct` (chỉ số đáp án đúng, bắt đầu từ 0)
 * và `explanation` không bao giờ được gửi cho trình duyệt của người chơi.
 *
 * Thêm câu hỏi: thêm object mới vào mảng, giữ `id` tăng dần, `options` có 2–4 phần tử.
 * Jackpot được quay sau mỗi 10 câu (câu 10, 20, 30, ...) và ở câu cuối cùng.
 */

const S1 = "Phần I – Cơ sở lý luận về vấn đề dân tộc";
const S2 = "Phần II – Đặc điểm dân tộc Việt Nam";
const S3 = "Phần III – Quan hệ dân tộc trong truyền thống đa văn hóa Việt Nam";
const S4 = "Phần IV – Quan điểm, chính sách, thực trạng và giải pháp hiện nay";
const S5 = "Phần V – Vấn đề tôn giáo trong thời kỳ quá độ lên CNXH";

module.exports = [
  // ===================== PHẦN I =====================
  {
    id: 1, section: S1,
    question: "Theo nội dung Chương 6, hai cách hiểu phổ biến của khái niệm “dân tộc” là gì?",
    options: [
      "Dân tộc – quốc gia và dân tộc – tộc người",
      "Dân tộc – kinh tế và dân tộc – chính trị",
      "Dân tộc – tôn giáo và dân tộc – giai cấp",
      "Dân tộc – địa phương và dân tộc – vùng miền"
    ],
    correct: 0,
    explanation: "Dân tộc được hiểu theo nghĩa quốc gia (dân tộc – quốc gia) và theo nghĩa tộc người (dân tộc – tộc người)."
  },
  {
    id: 2, section: S1,
    question: "Yếu tố nào SAU ĐÂY không được nêu trong nội dung về cộng đồng tộc người?",
    options: ["Ngôn ngữ", "Văn hóa", "Ý thức tự giác tộc người", "Mức thu nhập bình quân"],
    correct: 3,
    explanation: "Ba yếu tố được nêu là ngôn ngữ, văn hóa và ý thức tự giác tộc người."
  },
  {
    id: 3, section: S1,
    question: "Xu hướng khách quan thứ nhất của quan hệ dân tộc là gì?",
    options: [
      "Các cộng đồng dân cư muốn tách ra để hình thành cộng đồng dân tộc độc lập",
      "Các dân tộc xóa bỏ mọi bản sắc riêng",
      "Các dân tộc chỉ liên hiệp về kinh tế",
      "Các dân tộc từ bỏ quyền tự quyết"
    ],
    correct: 0,
    explanation: "Xu hướng thứ nhất: các cộng đồng dân cư muốn tách ra để hình thành cộng đồng dân tộc độc lập."
  },
  {
    id: 4, section: S1,
    question: "Xu hướng khách quan thứ hai của quan hệ dân tộc là gì?",
    options: [
      "Các dân tộc liên hiệp, xích lại gần nhau",
      "Các dân tộc tách khỏi mọi quan hệ",
      "Các dân tộc chỉ giao lưu văn hóa",
      "Các dân tộc cạnh tranh để loại bỏ nhau"
    ],
    correct: 0,
    explanation: "Xu hướng thứ hai: các dân tộc liên hiệp, xích lại gần nhau."
  },
  {
    id: 5, section: S1,
    question: "Cương lĩnh dân tộc của chủ nghĩa Mác – Lênin gồm bao nhiêu nguyên tắc cơ bản?",
    options: ["2", "3", "4", "5"],
    correct: 1,
    explanation: "Ba nguyên tắc: bình đẳng, quyền tự quyết và liên hiệp công nhân tất cả các dân tộc."
  },
  {
    id: 6, section: S1,
    question: "Nguyên tắc nào sau đây thuộc Cương lĩnh dân tộc của chủ nghĩa Mác – Lênin?",
    options: [
      "Các dân tộc hoàn toàn bình đẳng",
      "Dân tộc lớn có quyền cao hơn dân tộc nhỏ",
      "Chỉ ưu tiên một dân tộc",
      "Xóa bỏ mọi khác biệt văn hóa"
    ],
    correct: 0,
    explanation: "Các dân tộc hoàn toàn bình đẳng là một trong ba nguyên tắc."
  },
  {
    id: 7, section: S1,
    question: "Theo nội dung được cung cấp, quyền tự quyết của các dân tộc được hiểu như thế nào?",
    options: [
      "Đồng nghĩa với việc tùy tiện ly khai",
      "Là một nguyên tắc trong Cương lĩnh dân tộc và không đồng nghĩa với tùy tiện ly khai",
      "Chỉ áp dụng cho dân tộc lớn",
      "Chỉ liên quan đến văn hóa"
    ],
    correct: 1,
    explanation: "Quyền tự quyết không đồng nghĩa với việc tùy tiện ly khai."
  },
  {
    id: 8, section: S1,
    question: "“Liên hiệp công nhân tất cả các dân tộc” thể hiện nguyên tắc nào trong Cương lĩnh dân tộc?",
    options: ["Đoàn kết giữa các dân tộc", "Tách biệt các dân tộc", "Phân biệt dân tộc", "Ưu tiên dân tộc lớn"],
    correct: 0,
    explanation: "Đây là nguyên tắc thứ ba, nhấn mạnh sự đoàn kết giữa công nhân các dân tộc."
  },

  // ===================== PHẦN II =====================
  {
    id: 9, section: S2,
    question: "Việt Nam được khái quát là quốc gia như thế nào về thành phần dân tộc?",
    options: ["Đơn dân tộc", "Đa dân tộc", "Không có dân tộc thiểu số", "Chỉ có các cộng đồng tộc người"],
    correct: 1,
    explanation: "Việt Nam là quốc gia đa dân tộc."
  },
  {
    id: 10, section: S2,
    question: "Theo nội dung được cung cấp, Việt Nam có bao nhiêu dân tộc?",
    options: ["52", "53", "54", "55"],
    correct: 2,
    explanation: "Việt Nam có 54 dân tộc."
  },
  {
    id: 11, section: S2,
    question: "Đặc điểm nào đúng về dân số giữa các dân tộc ở Việt Nam?",
    options: [
      "Các dân tộc có số dân gần như bằng nhau",
      "Có sự chênh lệch lớn về số dân giữa các tộc người",
      "Dân tộc thiểu số chiếm đa số dân số cả nước",
      "Mỗi dân tộc có số dân trên một triệu người"
    ],
    correct: 1,
    explanation: "Giữa các tộc người ở Việt Nam có sự chênh lệch đáng kể về số dân."
  },
  {
    id: 12, section: S2,
    question: "Các dân tộc ở Việt Nam cư trú theo đặc điểm nào?",
    options: [
      "Mỗi dân tộc sống tách biệt trên một lãnh thổ riêng",
      "Chỉ tập trung ở vùng đồng bằng",
      "Cư trú xen kẽ nhau",
      "Chỉ tập trung ở các đô thị lớn"
    ],
    correct: 2,
    explanation: "Các dân tộc ở Việt Nam cư trú xen kẽ nhau, không có lãnh thổ tộc người riêng biệt."
  },
  {
    id: 13, section: S2,
    question: "Các dân tộc thiểu số ở Việt Nam phân bố chủ yếu ở đâu?",
    options: [
      "Ở các thành phố trực thuộc Trung ương",
      "Ở những địa bàn có vị trí chiến lược quan trọng như biên giới, miền núi",
      "Chỉ ở vùng đồng bằng sông Hồng",
      "Chỉ ở các đảo xa bờ"
    ],
    correct: 1,
    explanation: "Dân tộc thiểu số phân bố chủ yếu ở địa bàn có vị trí chiến lược quan trọng về chính trị, kinh tế, quốc phòng, an ninh và môi trường sinh thái."
  },
  {
    id: 14, section: S2,
    question: "Trình độ phát triển giữa các dân tộc ở Việt Nam có đặc điểm gì?",
    options: ["Hoàn toàn đồng đều", "Không đồng đều", "Dân tộc thiểu số phát triển hơn", "Không thể so sánh"],
    correct: 1,
    explanation: "Các dân tộc ở Việt Nam có trình độ phát triển không đều về kinh tế, văn hóa, xã hội."
  },
  {
    id: 15, section: S2,
    question: "Đặc trưng nổi bật trong quan hệ giữa các dân tộc ở Việt Nam là gì?",
    options: [
      "Thường xuyên xung đột sắc tộc",
      "Sống biệt lập, ít giao lưu",
      "Có truyền thống đoàn kết trong cộng đồng dân tộc – quốc gia thống nhất",
      "Chỉ liên kết khi có lợi ích kinh tế"
    ],
    correct: 2,
    explanation: "Các dân tộc Việt Nam có truyền thống đoàn kết gắn bó xây dựng quốc gia dân tộc thống nhất."
  },

  // ===================== PHẦN III =====================
  {
    id: 16, section: S3,
    question: "Bản sắc văn hóa riêng của mỗi dân tộc góp phần tạo nên nền văn hóa Việt Nam với đặc điểm nào?",
    options: ["Đồng nhất tuyệt đối", "Thống nhất trong đa dạng", "Tách rời, không liên hệ", "Chỉ mang bản sắc của dân tộc đa số"],
    correct: 1,
    explanation: "Mỗi dân tộc có bản sắc riêng, cùng tạo nên sự phong phú, đa dạng và thống nhất của văn hóa Việt Nam."
  },
  {
    id: 17, section: S3,
    question: "Yếu tố nào góp phần hình thành truyền thống đoàn kết của cộng đồng các dân tộc Việt Nam?",
    options: [
      "Các dân tộc có chung một ngôn ngữ duy nhất",
      "Các dân tộc sống tách biệt nên ít mâu thuẫn",
      "Yêu cầu cùng chống thiên tai, chống giặc ngoại xâm, dựng nước và giữ nước",
      "Tất cả các dân tộc theo cùng một tôn giáo"
    ],
    correct: 2,
    explanation: "Quá trình cùng đấu tranh chống thiên tai, giặc ngoại xâm để dựng nước và giữ nước đã hun đúc truyền thống đoàn kết."
  },
  {
    id: 18, section: S3,
    question: "Ngày lễ nào thể hiện ý thức về cội nguồn chung của cộng đồng các dân tộc Việt Nam?",
    options: ["Tết Trung thu", "Giỗ Tổ Hùng Vương (10/3 âm lịch)", "Lễ Vu Lan", "Tết Đoan Ngọ"],
    correct: 1,
    explanation: "Giỗ Tổ Hùng Vương thể hiện truyền thống “uống nước nhớ nguồn”, ý thức cội nguồn chung của dân tộc."
  },
  {
    id: 19, section: S3,
    question: "Theo Hiến pháp năm 2013, các dân tộc ở Việt Nam có quyền gì đối với tiếng nói, chữ viết của mình?",
    options: [
      "Chỉ được dùng tiếng Việt",
      "Được dùng tiếng nói, chữ viết, giữ gìn bản sắc dân tộc",
      "Chỉ được dùng trong gia đình",
      "Phải xin phép khi sử dụng"
    ],
    correct: 1,
    explanation: "Điều 5 Hiến pháp 2013: các dân tộc có quyền dùng tiếng nói, chữ viết, giữ gìn bản sắc dân tộc, phát huy phong tục, tập quán, truyền thống và văn hóa tốt đẹp."
  },
  {
    id: 20, section: S3,
    question: "Theo Hiến pháp năm 2013, hành vi nào trong quan hệ dân tộc bị nghiêm cấm?",
    options: [
      "Giao lưu văn hóa giữa các dân tộc",
      "Học tiếng của dân tộc khác",
      "Mọi hành vi kỳ thị, chia rẽ dân tộc",
      "Tổ chức lễ hội truyền thống"
    ],
    correct: 2,
    explanation: "Điều 5 Hiến pháp 2013: các dân tộc bình đẳng, đoàn kết, tôn trọng và giúp nhau cùng phát triển; nghiêm cấm mọi hành vi kỳ thị, chia rẽ dân tộc."
  },

  // ===================== PHẦN IV =====================
  {
    id: 21, section: S4,
    question: "Đảng Cộng sản Việt Nam xác định vấn đề dân tộc và đoàn kết dân tộc là vấn đề như thế nào?",
    options: [
      "Vấn đề tạm thời, mang tính sách lược",
      "Vấn đề chiến lược cơ bản, lâu dài, đồng thời là vấn đề cấp bách",
      "Vấn đề riêng của vùng dân tộc thiểu số",
      "Vấn đề chỉ thuộc lĩnh vực văn hóa"
    ],
    correct: 1,
    explanation: "Vấn đề dân tộc và đoàn kết dân tộc là vấn đề chiến lược cơ bản, lâu dài, đồng thời cũng là vấn đề cấp bách của cách mạng Việt Nam."
  },
  {
    id: 22, section: S4,
    question: "Nghị quyết chuyên đề về công tác dân tộc của Hội nghị Trung ương 7 khóa IX (năm 2003) là?",
    options: ["Nghị quyết 24-NQ/TW", "Nghị quyết 25-NQ/TW", "Nghị quyết 36-NQ/TW", "Nghị quyết 10-NQ/TW"],
    correct: 0,
    explanation: "Nghị quyết số 24-NQ/TW ngày 12/3/2003 của Hội nghị Trung ương 7 khóa IX về công tác dân tộc."
  },
  {
    id: 23, section: S4,
    question: "Nguyên tắc cơ bản trong quan hệ giữa các dân tộc ở Việt Nam theo quan điểm của Đảng là gì?",
    options: [
      "Bình đẳng, đoàn kết, tôn trọng, giúp nhau cùng phát triển",
      "Dân tộc đa số lãnh đạo dân tộc thiểu số",
      "Mỗi dân tộc tự phát triển riêng",
      "Ưu tiên tuyệt đối cho một vùng"
    ],
    correct: 0,
    explanation: "Các dân tộc bình đẳng, đoàn kết, tôn trọng, giúp nhau cùng phát triển."
  },
  {
    id: 24, section: S4,
    question: "Chính sách dân tộc về kinh tế hướng tới mục tiêu nào?",
    options: [
      "Chỉ phát triển vùng đồng bằng",
      "Phát huy tiềm năng, từng bước khắc phục khoảng cách chênh lệch giữa các vùng, các dân tộc",
      "Giữ nguyên phương thức sản xuất truyền thống",
      "Xóa bỏ kinh tế của đồng bào dân tộc thiểu số"
    ],
    correct: 1,
    explanation: "Chính sách kinh tế nhằm phát huy tiềm năng phát triển, từng bước khắc phục khoảng cách chênh lệch giữa các vùng, giữa các dân tộc."
  },
  {
    id: 25, section: S4,
    question: "Công tác dân tộc và thực hiện chính sách dân tộc là nhiệm vụ của ai?",
    options: [
      "Riêng Ủy ban Dân tộc",
      "Riêng đồng bào dân tộc thiểu số",
      "Toàn Đảng, toàn dân, toàn quân, các cấp, các ngành và toàn bộ hệ thống chính trị",
      "Chính quyền địa phương vùng núi"
    ],
    correct: 2,
    explanation: "Công tác dân tộc là nhiệm vụ của toàn Đảng, toàn dân, toàn quân, của các cấp, các ngành và của cả hệ thống chính trị."
  },
  {
    id: 26, section: S4,
    question: "Chính sách dân tộc về văn hóa có nội dung chủ yếu nào?",
    options: [
      "Thay thế văn hóa các dân tộc bằng một nền văn hóa chung",
      "Xây dựng nền văn hóa tiên tiến, đậm đà bản sắc dân tộc; giữ gìn, phát huy giá trị văn hóa truyền thống các dân tộc",
      "Chỉ bảo tồn văn hóa dân tộc đa số",
      "Hạn chế giao lưu văn hóa"
    ],
    correct: 1,
    explanation: "Xây dựng nền văn hóa Việt Nam tiên tiến, đậm đà bản sắc dân tộc; giữ gìn và phát huy giá trị văn hóa truyền thống của các dân tộc."
  },
  {
    id: 27, section: S4,
    question: "Chính sách dân tộc về quốc phòng – an ninh nhằm mục đích gì?",
    options: [
      "Tăng cường sức mạnh bảo vệ Tổ quốc, bảo đảm ổn định chính trị, trật tự an toàn xã hội vùng đồng bào dân tộc",
      "Chỉ xây dựng lực lượng vũ trang ở đô thị",
      "Hạn chế người dân tộc thiểu số tham gia quốc phòng",
      "Tách vùng dân tộc thiểu số khỏi thế trận quốc phòng toàn dân"
    ],
    correct: 0,
    explanation: "Tăng cường sức mạnh bảo vệ Tổ quốc trên cơ sở bảo đảm ổn định chính trị, trật tự an toàn xã hội ở vùng đồng bào dân tộc."
  },
  {
    id: 28, section: S4,
    question: "Một thách thức hiện nay trong vấn đề dân tộc ở Việt Nam là gì?",
    options: [
      "Các dân tộc đã phát triển hoàn toàn đồng đều",
      "Không còn khoảng cách giàu nghèo giữa các vùng",
      "Các thế lực thù địch lợi dụng vấn đề dân tộc để chia rẽ khối đại đoàn kết toàn dân tộc",
      "Không còn dân tộc thiểu số nào"
    ],
    correct: 2,
    explanation: "Các thế lực thù địch thường lợi dụng vấn đề dân tộc, tôn giáo để kích động, chia rẽ khối đại đoàn kết toàn dân tộc."
  },

  // ===================== PHẦN V – TÔN GIÁO =====================
  {
    id: 29, section: S5,
    question: "Theo chủ nghĩa Mác – Lênin, bản chất của tôn giáo là gì?",
    options: [
      "Một hình thái ý thức xã hội phản ánh một cách hư ảo hiện thực khách quan",
      "Một khoa học tự nhiên",
      "Một thiết chế kinh tế",
      "Một hệ thống pháp luật"
    ],
    correct: 0,
    explanation: "Tôn giáo là một hình thái ý thức xã hội phản ánh một cách hư ảo hiện thực khách quan vào đầu óc con người."
  },
  {
    id: 30, section: S5,
    question: "Nguồn gốc của tôn giáo gồm những nguồn gốc nào?",
    options: [
      "Chỉ có nguồn gốc tâm lý",
      "Kinh tế – xã hội, nhận thức và tâm lý",
      "Chỉ có nguồn gốc chính trị",
      "Địa lý, khí hậu và dân số"
    ],
    correct: 1,
    explanation: "Tôn giáo có nguồn gốc kinh tế – xã hội, nguồn gốc nhận thức và nguồn gốc tâm lý."
  },
  {
    id: 31, section: S5,
    question: "Tôn giáo có những tính chất cơ bản nào?",
    options: [
      "Tính khoa học, tính pháp lý, tính kinh tế",
      "Tính lịch sử, tính quần chúng, tính chính trị",
      "Tính giai cấp tuyệt đối và vĩnh viễn",
      "Tính địa phương và tính tạm thời"
    ],
    correct: 1,
    explanation: "Tôn giáo có tính lịch sử, tính quần chúng và tính chính trị."
  },
  {
    id: 32, section: S5,
    question: "Luận điểm “Tôn giáo là thuốc phiện của nhân dân” là của ai?",
    options: ["V.I. Lênin", "Ph. Ăngghen", "C. Mác", "Hồ Chí Minh"],
    correct: 2,
    explanation: "Đây là luận điểm của C. Mác trong tác phẩm Góp phần phê phán triết học pháp quyền của Hêghen."
  },
  {
    id: 33, section: S5,
    question: "Nguyên tắc đầu tiên khi giải quyết vấn đề tôn giáo trong thời kỳ quá độ lên CNXH là gì?",
    options: [
      "Xóa bỏ ngay mọi tôn giáo",
      "Tôn trọng, bảo đảm quyền tự do tín ngưỡng và không tín ngưỡng của nhân dân",
      "Chỉ cho phép một tôn giáo hoạt động",
      "Để tôn giáo hoạt động không cần tuân theo pháp luật"
    ],
    correct: 1,
    explanation: "Tôn trọng, bảo đảm quyền tự do tín ngưỡng và không tín ngưỡng của nhân dân."
  },
  {
    id: 34, section: S5,
    question: "Khi giải quyết vấn đề tôn giáo, cần phân biệt hai mặt nào?",
    options: [
      "Mặt kinh tế và mặt văn hóa",
      "Mặt chính trị và mặt tư tưởng",
      "Mặt lịch sử và mặt địa lý",
      "Mặt cá nhân và mặt gia đình"
    ],
    correct: 1,
    explanation: "Phân biệt mặt chính trị (lợi dụng tôn giáo chống phá) và mặt tư tưởng (nhu cầu tín ngưỡng của quần chúng)."
  },
  {
    id: 35, section: S5,
    question: "Đặc điểm nào đúng về tôn giáo ở Việt Nam?",
    options: [
      "Chỉ có một tôn giáo duy nhất",
      "Thường xuyên xảy ra chiến tranh tôn giáo",
      "Đa tôn giáo, đan xen, chung sống hòa bình, không có xung đột, chiến tranh tôn giáo",
      "Không có tôn giáo du nhập từ bên ngoài"
    ],
    correct: 2,
    explanation: "Việt Nam là quốc gia có nhiều tôn giáo, các tôn giáo đa dạng, đan xen, chung sống hòa bình."
  },
  {
    id: 36, section: S5,
    question: "Tín đồ các tôn giáo ở Việt Nam phần lớn là ai?",
    options: [
      "Chủ yếu là người nước ngoài",
      "Nhân dân lao động, có lòng yêu nước, tinh thần dân tộc",
      "Chủ yếu là tầng lớp thống trị cũ",
      "Chỉ là người cao tuổi"
    ],
    correct: 1,
    explanation: "Tín đồ các tôn giáo phần lớn là nhân dân lao động, có lòng yêu nước, tinh thần dân tộc."
  },
  {
    id: 37, section: S5,
    question: "Theo quan điểm của Đảng, tín ngưỡng, tôn giáo là gì?",
    options: [
      "Hiện tượng sẽ mất đi ngay khi xây dựng CNXH",
      "Nhu cầu tinh thần của một bộ phận nhân dân, đang và sẽ tồn tại cùng dân tộc trong quá trình xây dựng CNXH",
      "Tàn dư cần xóa bỏ bằng mệnh lệnh hành chính",
      "Vấn đề riêng, Nhà nước không quản lý"
    ],
    correct: 1,
    explanation: "Tín ngưỡng, tôn giáo là nhu cầu tinh thần của một bộ phận nhân dân, đang và sẽ tồn tại cùng dân tộc trong quá trình xây dựng CNXH."
  },
  {
    id: 38, section: S5,
    question: "Nội dung cốt lõi của công tác tôn giáo là gì?",
    options: ["Công tác vận động quần chúng", "Công tác kiểm tra, xử phạt", "Công tác xây dựng cơ sở thờ tự", "Công tác đối ngoại"],
    correct: 0,
    explanation: "Nội dung cốt lõi của công tác tôn giáo là công tác vận động quần chúng."
  },
  {
    id: 39, section: S5,
    question: "Luật Tín ngưỡng, tôn giáo (Quốc hội thông qua năm 2016) có hiệu lực từ ngày nào?",
    options: ["01/01/2017", "01/07/2017", "01/01/2018", "01/07/2018"],
    correct: 2,
    explanation: "Luật Tín ngưỡng, tôn giáo được thông qua ngày 18/11/2016 và có hiệu lực từ ngày 01/01/2018."
  },
  {
    id: 40, section: S5,
    question: "Quan hệ dân tộc và tôn giáo ở Việt Nam được thiết lập và củng cố trên cơ sở nào?",
    options: [
      "Mỗi tôn giáo gắn với một dân tộc riêng",
      "Cộng đồng quốc gia – dân tộc thống nhất",
      "Sự tách biệt giữa dân tộc và tôn giáo",
      "Sự chi phối của tôn giáo đối với nhà nước"
    ],
    correct: 1,
    explanation: "Quan hệ dân tộc và tôn giáo ở Việt Nam được thiết lập và củng cố trên cơ sở cộng đồng quốc gia – dân tộc thống nhất."
  }
];
