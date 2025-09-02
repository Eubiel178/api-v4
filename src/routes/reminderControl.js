const ReminderModel = require("../models/reminder.model");
const SubscriptionModel = require("../models/subscription.model");
const { Router } = require("express");

const connectToDatabase = require("../database/connect");
const webPush = require("web-push");

const router = Router();

router.get("/send-reminders", async (req, res) => {
  try {
    console.log("🔔 Cron job iniciando...");

    await connectToDatabase();
    webPush.setVapidDetails(
      "mailto:dev123gabriel@gmail.com",
      "BHLOs2Z5r8k7u7bmOKqrMfnBQuOWnEc8bI2hJW-vTGHp4aNnNibOftiHa1R62CfoIbjTaaKhlBlNxUj4K54K_-k", // chave pública
      "W8FNlXzA8YP43KqsJk7lzCDmgzbIB7VPb2caDusJqB4" // chave privada
    );

    console.log("🔔 Cron job executando...");

    const now = new Date();
    const ano = now.getFullYear();
    const mes = String(now.getMonth() + 1).padStart(2, "0"); // meses começam do 0
    const dia = String(now.getDate()).padStart(2, "0");
    const hojeStr = `${ano}-${mes}-${dia}`;

    const lembretes = await ReminderModel.find({
      remindAt: hojeStr,
      notificado: false,
    });
    for (const lembrete of lembretes) {
      const sub = await SubscriptionModel.findOne({ userID: lembrete.userID });
      if (!sub) continue;

      try {
        await webPush.sendNotification(
          sub.subscription,
          JSON.stringify({
            title: lembrete?.title || "Lembrete",
            message: lembrete?.description,
          })
        );
        lembrete.notificado = true;
        lembrete.remindedAt = new Date(); // <-- salva a data/hora em inglês

        await lembrete.save();
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await SubscriptionModel.deleteOne({ userID: lembrete.userID });
        }
      }
    }

    return res.status(200).json({ ok: true, enviados: lembretes.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/reminders", async (req, res) => {
  try {
    const { body } = req;

    const reminder = await ReminderModel.create(body);

    return res.status(200).json({ status: "OK", reminder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "ERROR", errorMessage: error.message });
  }
});

// Rota para listar lembretes de um usuário pelo ID
router.get("/reminders-list/:userID", async (req, res) => {
  try {
    const { userID } = req.params;

    const lembretes = await ReminderModel.find({ userID }).sort({
      createdAt: -1,
    }); // -1 = decrescente

    return res.status(200).json(lembretes);
  } catch (err) {
    console.error("Erro ao buscar lembretes:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});
// Rota para editar um lembrete pelo ID
router.put("/reminders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body; // campos a atualizar

    // garante conexão com o banco
    await connectToDatabase();

    const updatedReminder = await ReminderModel.findOneAndUpdate(
      { taskId: id }, // busca pelo campo taskId
      updates, // dados a atualizar
      { new: true } // retorna o documento atualizado
    );

    if (!updatedReminder) {
      return res
        .status(404)
        .json({ ok: false, message: "Lembrete não encontrado" });
    }

    return res.status(200).json({
      ok: true,
      message: "Lembrete atualizado com sucesso",
      lembrete: updatedReminder,
    });
  } catch (err) {
    console.error("Erro ao editar lembrete:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Rota para deletar um lembrete pelo ID
router.delete("/reminders/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // garante conexão com o banco (se ainda não estiver conectado)
    await connectToDatabase();

    const deleted = await ReminderModel.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ ok: false, message: "Lembrete não encontrado" });
    }

    return res.status(200).json({
      ok: true,
      message: "Lembrete deletado com sucesso",
      lembrete: deleted,
    });
  } catch (err) {
    console.error("Erro ao deletar lembrete:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/save-subscription", async (req, res) => {
  const { userID, subscription } = req.body;
  if (!userID || !subscription) return res.status(400).send("Dados inválidos");

  try {
    // busca a subscription existente
    const existing = await SubscriptionModel.findOne({ userID });

    // compara as subscriptions
    const isSame =
      existing &&
      JSON.stringify(existing.subscription) === JSON.stringify(subscription);
    console.log(isSame, "issame");

    if (isSame) {
      // já está salva, não precisa atualizar
      console.log("Subscription já existente e válida:", existing);
      return res.send({
        success: true,
        subscription: existing,
        message: "Subscription já válida",
      });
    }

    // se não existir ou for diferente, cria/atualiza
    const saved = await SubscriptionModel.findOneAndUpdate(
      { userID },
      { subscription },
      { upsert: true, new: true }
    );

    console.log("Subscription salva/atualizada:", saved);
    res.send({ success: true, subscription: saved });
  } catch (err) {
    console.error("Erro ao salvar subscription:", err);
    res.status(500).send({ success: false, error: err.message });
  }
});

// router.get("/reminders", async (req, res) => {
//   try {
//     await connectToDatabase(); // garante conexão antes de qualquer find/create

//     // Criar novo lembrete

//     // Enviar lembretes do dia
//     console.log("🔔 Checando lembretes do dia...");
//     const hojeStr = new Date().toISOString().slice(0, 10);

//     const lembretes = await ReminderModel.find({
//       remindAt: hojeStr,
//       notificado: false,
//     });

//     console.log(lembretes);

//     for (const lembrete of lembretes) {
//       const sub = await SubscriptionModel.findOne({
//         userID: lembrete.userID,
//       });
//       if (!sub) continue;

//       try {
//         await webPush.sendNotification(
//           sub.subscription,
//           JSON.stringify({
//             title: lembrete?.title || "Lembrete",
//             message: lembrete?.description,
//           })
//         );

//         lembrete.notificado = true;
//         await lembrete.save();
//         console.log("Notificado:", lembrete.title);
//       } catch (err) {
//         if (err.statusCode === 410 || err.statusCode === 404) {
//           console.log(`Subscription expirada ou removida. Deletando...`);
//           await SubscriptionModel.deleteOne({ userID: lembrete.userID });
//         } else {
//           console.error("Erro ao enviar notificação:", err);
//         }
//       }
//     }

//     return res.status(200).json({ ok: true, enviados: lembretes.length });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ status: "ERROR", errorMessage: error.message });
//   }
// });

module.exports = router;
